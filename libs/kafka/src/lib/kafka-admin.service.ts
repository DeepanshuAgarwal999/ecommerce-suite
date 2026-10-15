import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ALL_TOPICS,
  DEFAULT_PARTITIONS,
  DEFAULT_REPLICATION_FACTOR,
  TOPIC_PARTITIONS,
  dlqTopic,
} from '@ecommerce/contracts';
import type { Kafka } from 'kafkajs';
import { KAFKA_CLIENT } from './kafka.constants';

/**
 * Creates topics up front.
 *
 * Auto-creation is disabled on producers and consumers on purpose: it silently creates
 * topics with the broker default partition count, and partition count cannot be lowered
 * afterwards. Declaring them here keeps partitioning an explicit decision.
 */
@Injectable()
export class KafkaAdminService {
  private readonly logger = new Logger(KafkaAdminService.name);

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: Kafka) {}

  async ensureTopics(topics: string[] = ALL_TOPICS, includeDlq = true): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      const existing = new Set(await admin.listTopics());
      const wanted = includeDlq ? [...topics, ...topics.map(dlqTopic)] : topics;
      const missing = wanted.filter((topic) => !existing.has(topic));

      if (missing.length === 0) {
        this.logger.log(`all ${wanted.length} topics already exist`);
        return;
      }

      await admin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({
          topic,
          numPartitions: TOPIC_PARTITIONS[topic] ?? DEFAULT_PARTITIONS,
          replicationFactor: DEFAULT_REPLICATION_FACTOR,
          configEntries: [
            { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        })),
      });

      this.logger.log(`created ${missing.length} topics`);
    } finally {
      await admin.disconnect();
    }
  }

  /** Consumer lag per partition - the number that tells you whether to scale consumers. */
  async describeLag(groupId: string): Promise<Record<string, number>> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const offsets = await admin.fetchOffsets({ groupId });
      const lag: Record<string, number> = {};

      for (const { topic, partitions } of offsets) {
        const latest = await admin.fetchTopicOffsets(topic);
        for (const partition of partitions) {
          const head = latest.find((entry) => entry.partition === partition.partition);
          if (!head) continue;
          lag[`${topic}:${partition.partition}`] =
            Number(head.high) - Number(partition.offset === '-1' ? head.high : partition.offset);
        }
      }
      return lag;
    } finally {
      await admin.disconnect();
    }
  }

  async isHealthy(): Promise<boolean> {
    const admin = this.kafka.admin();
    try {
      await admin.connect();
      await admin.listTopics();
      return true;
    } catch {
      return false;
    } finally {
      await admin.disconnect().catch(() => undefined);
    }
  }
}
