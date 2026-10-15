import { Logger } from '@nestjs/common';
import { EventEnvelope } from '@ecommerce/contracts';
import { KafkaProducerService } from './kafka-producer.service';

/**
 * A row in a service's `OutboxEvent` table.
 *
 * Every service that emits events owns one of these tables with an identical shape,
 * which is why the drainer below can be generic over the Prisma client.
 */
export interface OutboxRecord {
  id: string;
  topic: string;
  partitionKey: string;
  payload: unknown;
  eventType: string;
  eventVersion: number;
  correlationId: string | null;
  causationId: string | null;
  actorId: string | null;
  source: string | null;
  createdAt: Date;
  attempts: number;
}

/** The subset of a Prisma client the drainer needs, so it works with any service's client. */
export interface OutboxDelegate {
  findMany(args: unknown): Promise<OutboxRecord[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
  update(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<{ count: number }>;
}

/**
 * Transactional outbox drainer.
 *
 * The problem it solves: writing to Postgres and publishing to Kafka are two systems,
 * so a crash between them either loses the event or publishes one for a transaction
 * that rolled back. Instead, the event row is written *inside* the same transaction as
 * the state change, and this loop ships it afterwards. Delivery becomes at-least-once,
 * which consumers already handle by deduping on `eventId`.
 *
 * At high volume, replace this poller with Debezium CDC on the same table - the table
 * shape and consumer contract stay identical.
 */
export class OutboxDrainer {
  private readonly logger = new Logger(OutboxDrainer.name);

  constructor(
    private readonly delegate: OutboxDelegate,
    private readonly producer: KafkaProducerService,
    private readonly serviceName: string,
  ) {}

  /**
   * Publishes one batch of pending rows.
   *
   * Callers must hold a distributed lock so that only one instance drains at a time;
   * otherwise every replica publishes every row. Duplicates would be tolerable but
   * wasteful.
   */
  async drain(batchSize = 200, maxAttempts = 10): Promise<number> {
    const pending = await this.delegate.findMany({
      where: { publishedAt: null, attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (pending.length === 0) return 0;

    // Group by topic so each topic is one produce request rather than one per row.
    const byTopic = new Map<string, { record: OutboxRecord; envelope: EventEnvelope }[]>();
    for (const record of pending) {
      const envelope: EventEnvelope = {
        eventId: record.id,
        eventType: record.eventType,
        eventVersion: record.eventVersion,
        occurredAt: record.createdAt.toISOString(),
        producer: this.serviceName,
        correlationId: record.correlationId ?? record.id,
        causationId: record.causationId ?? undefined,
        actorId: record.actorId ?? undefined,
        source: record.source ?? undefined,
        partitionKey: record.partitionKey,
        payload: record.payload,
      };
      const bucket = byTopic.get(record.topic) ?? [];
      bucket.push({ record, envelope });
      byTopic.set(record.topic, bucket);
    }

    let published = 0;

    for (const [topic, entries] of byTopic) {
      try {
        await this.producer.emitEnvelopes(
          topic,
          entries.map((entry) => entry.envelope),
        );
        await this.delegate.updateMany({
          where: { id: { in: entries.map((entry) => entry.record.id) } },
          data: { publishedAt: new Date() },
        });
        published += entries.length;
      } catch (error) {
        // Bump attempts so a permanently broken row eventually stops being retried
        // and shows up in the stuck-events check instead of spinning forever.
        this.logger.error(`outbox publish failed for ${topic}: ${(error as Error).message}`);
        await this.delegate.updateMany({
          where: { id: { in: entries.map((entry) => entry.record.id) } },
          data: {
            attempts: { increment: 1 },
            lastError: (error as Error).message.slice(0, 500),
          },
        });
      }
    }

    return published;
  }

  /** Housekeeping: drop rows already shipped, so the table stays small and fast. */
  async purgePublished(olderThanHours = 48): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);
    const { count } = await this.delegate.deleteMany({
      where: { publishedAt: { not: null, lt: cutoff } },
    });
    return count;
  }
}

/**
 * Builds an outbox row. Call this inside the same Prisma transaction as the state
 * change it describes - that is the entire point of the pattern.
 */
export function outboxRow(input: {
  topic: string;
  partitionKey: string;
  payload: unknown;
  eventVersion?: number;
  correlationId?: string;
  causationId?: string;
  actorId?: string;
  source?: string;
}) {
  return {
    topic: input.topic,
    eventType: input.topic,
    eventVersion: input.eventVersion ?? 1,
    partitionKey: input.partitionKey,
    payload: input.payload as never,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    actorId: input.actorId ?? null,
    source: input.source ?? null,
  };
}
