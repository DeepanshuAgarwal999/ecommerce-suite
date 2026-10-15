import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { EventEnvelope, dlqTopic } from '@ecommerce/contracts';
import type { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import {
  ConsumerRegistration,
  KAFKA_CLIENT,
  KAFKA_OPTIONS,
  KafkaModuleOptions,
} from './kafka.constants';
import { KafkaProducerService } from './kafka-producer.service';

export type MessageHandler<T = unknown> = (
  envelope: EventEnvelope<T>,
  raw: EachMessagePayload,
) => Promise<void>;

/**
 * Owns the consumer lifecycle for a service.
 *
 * Failure handling is deliberate. A handler that throws is retried in-process with
 * backoff; if it still fails, the message goes to `<topic>.dlq` and the offset is
 * committed. The alternative - retrying forever - stops the whole partition, so one
 * poison message takes down every order behind it.
 */
@Injectable()
export class KafkaConsumerService implements OnApplicationShutdown {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(KAFKA_OPTIONS) private readonly options: KafkaModuleOptions,
    private readonly producer: KafkaProducerService,
  ) {}

  /**
   * Subscribes a handler map. Keys are topic names, so one consumer group can span
   * several topics and still route to the right handler.
   */
  async subscribe(
    registration: ConsumerRegistration,
    handlers: Record<string, MessageHandler<never>>,
  ): Promise<Consumer> {
    const consumer = this.kafka.consumer({
      groupId: registration.groupId,
      sessionTimeout: this.options.consumer?.sessionTimeout ?? 30_000,
      heartbeatInterval: this.options.consumer?.heartbeatInterval ?? 3_000,
      maxBytesPerPartition: this.options.consumer?.maxBytesPerPartition ?? 1_048_576,
      allowAutoTopicCreation: false,
      retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
    });

    await consumer.connect();
    for (const topic of registration.topics) {
      await consumer.subscribe({ topic, fromBeginning: registration.fromBeginning ?? false });
    }

    const maxRetries = registration.maxRetries ?? this.options.consumer?.retries ?? 3;

    await consumer.run({
      // Lets kafkajs process several partitions of this group at once. Ordering within
      // a partition is untouched, so per-aggregate ordering still holds.
      partitionsConsumedConcurrently: registration.partitionConcurrency ?? 3,
      eachMessage: async (payload) => {
        const { topic, partition, message } = payload;
        const handler = handlers[topic];
        if (!handler) {
          this.logger.warn(`no handler registered for topic ${topic}`);
          return;
        }

        let envelope: EventEnvelope;
        try {
          envelope = JSON.parse(message.value?.toString() ?? '{}') as EventEnvelope;
        } catch (error) {
          this.logger.error(`unparseable message on ${topic}: ${(error as Error).message}`);
          await this.sendToDlq(payload, 'MALFORMED_JSON');
          return;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await (handler as MessageHandler)(envelope, payload);
            return;
          } catch (error) {
            const err = error as Error;
            const isLast = attempt === maxRetries;
            this.logger.error(
              `handler failed [${topic} p${partition} attempt ${attempt}/${maxRetries}] ` +
                `eventId=${envelope.eventId}: ${err.message}`,
            );

            if (isLast) {
              if (registration.deadLetter === false) throw error;
              await this.sendToDlq(payload, err.message);
              return;
            }
            // Exponential backoff, capped. Heartbeats keep flowing meanwhile because
            // kafkajs runs them on its own timer.
            await new Promise((resolve) => setTimeout(resolve, Math.min(2 ** attempt * 250, 8_000)));
          }
        }
      },
    });

    this.consumers.push(consumer);
    this.logger.log(
      `consumer group ${registration.groupId} subscribed to [${registration.topics.join(', ')}]`,
    );
    return consumer;
  }

  private async sendToDlq(payload: EachMessagePayload, reason: string): Promise<void> {
    const { topic, message, partition } = payload;
    try {
      await this.producer.publish(dlqTopic(topic), [
        {
          key: message.key,
          value: message.value,
          headers: {
            ...message.headers,
            'dlq-reason': reason,
            'dlq-source-topic': topic,
            'dlq-source-partition': String(partition),
            'dlq-source-offset': message.offset,
            'dlq-at': new Date().toISOString(),
          },
        },
      ]);
      this.logger.warn(`message moved to ${dlqTopic(topic)}: ${reason}`);
    } catch (error) {
      this.logger.error(`failed to write to DLQ for ${topic}: ${(error as Error).message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    // Disconnecting triggers a clean group rebalance instead of waiting out the
    // session timeout, which is what makes rolling deploys not stall consumption.
    await Promise.allSettled(this.consumers.map((consumer) => consumer.disconnect()));
  }
}
