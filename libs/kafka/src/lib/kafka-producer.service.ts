import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEnvelope, EventMetadata } from '@ecommerce/contracts';
import { randomUUID } from 'node:crypto';
import { CompressionTypes } from 'kafkajs';
import type { Kafka, Message, Producer } from 'kafkajs';
import { KAFKA_CLIENT, KAFKA_OPTIONS, KafkaModuleOptions } from './kafka.constants';

/**
 * Publishes domain events.
 *
 * Two rules hold everywhere:
 *  - Every message is keyed by its aggregate id. Kafka guarantees ordering per
 *    partition, so keying by aggregate is what keeps "order.created" ahead of
 *    "order.confirmed" for the same order while still allowing parallel consumers.
 *  - Every message carries an `eventId`, so consumers can dedupe redeliveries.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer!: Producer;
  private connected = false;

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(KAFKA_OPTIONS) private readonly options: KafkaModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer({
      idempotent: this.options.producer?.idempotent ?? true,
      maxInFlightRequests: this.options.producer?.idempotent === false ? undefined : 5,
      allowAutoTopicCreation: false,
      retry: { retries: 8, initialRetryTime: 100, maxRetryTime: 30_000 },
    });

    await this.producer.connect();
    this.connected = true;
    this.logger.log(`kafka producer connected (${this.options.brokers.join(',')})`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    // Drains in-flight batches; without it a rolling deploy silently drops events.
    await this.producer.disconnect();
    this.connected = false;
  }

  buildEnvelope<T>(
    eventType: string,
    partitionKey: string,
    payload: T,
    metadata: EventMetadata = {},
  ): EventEnvelope<T> {
    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: metadata.eventVersion ?? 1,
      occurredAt: (metadata.occurredAt
        ? new Date(metadata.occurredAt)
        : new Date()
      ).toISOString(),
      producer: this.options.clientId,
      correlationId: metadata.correlationId ?? randomUUID(),
      causationId: metadata.causationId,
      actorId: metadata.actorId,
      source: metadata.source,
      partitionKey,
      payload,
    };
  }

  /** Publishes one event. The returned envelope is useful as a causation id upstream. */
  async emit<T>(
    topic: string,
    partitionKey: string,
    payload: T,
    metadata: EventMetadata = {},
  ): Promise<EventEnvelope<T>> {
    const envelope = this.buildEnvelope(topic, partitionKey, payload, metadata);
    await this.publish(topic, [
      {
        key: partitionKey,
        value: JSON.stringify(envelope),
        headers: {
          'event-id': envelope.eventId,
          'event-type': envelope.eventType,
          'correlation-id': envelope.correlationId,
          producer: envelope.producer,
        },
      },
    ]);
    return envelope;
  }

  /** Publishes pre-built envelopes - used by the outbox drainer. */
  async emitEnvelopes(topic: string, envelopes: EventEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;
    await this.publish(
      topic,
      envelopes.map((envelope) => ({
        key: envelope.partitionKey,
        value: JSON.stringify(envelope),
        headers: {
          'event-id': envelope.eventId,
          'event-type': envelope.eventType,
          'correlation-id': envelope.correlationId,
          producer: envelope.producer,
        },
      })),
    );
  }

  /** Raw send for retry/DLQ republishing, where the envelope is already serialised. */
  async publish(topic: string, messages: Message[]): Promise<void> {
    if (!this.connected) throw new Error('Kafka producer is not connected');
    await this.producer.send({
      topic,
      messages,
      acks: this.options.producer?.acks ?? -1,
      // GZIP is bundled with kafkajs; snappy/lz4/zstd would need extra native deps.
      compression:
        this.options.producer?.compression === false ? undefined : CompressionTypes.GZIP,
    });
  }

  /**
   * Sends to several topics atomically. Kafka transactions only cover Kafka, so this
   * still cannot span the database - that is exactly why the outbox exists.
   */
  async publishBatch(records: { topic: string; messages: Message[] }[]): Promise<void> {
    if (records.length === 0) return;
    await this.producer.sendBatch({
      topicMessages: records,
      acks: this.options.producer?.acks ?? -1,
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
