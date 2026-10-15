import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KafkaProducerService, OutboxDrainer } from '@ecommerce/kafka';
import { LockService } from '@ecommerce/redis';
import { ServiceNames } from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ships outbox rows to Kafka.
 *
 * Runs on every replica but takes a distributed lock first, so exactly one instance
 * drains at a time. Without the lock every replica would publish every row - consumers
 * dedupe, so nothing breaks, but the wasted throughput is real.
 *
 * The interval is a floor, not a latency guarantee. Anything needing sub-second
 * propagation should move to Debezium CDC against the same table.
 */
@Injectable()
export class OutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessor.name);
  private drainer!: OutboxDrainer;
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: KafkaProducerService,
    private readonly locks: LockService,
  ) {}

  onModuleInit(): void {
    this.drainer = new OutboxDrainer(
      this.prisma.outboxEvent as never,
      this.producer,
      ServiceNames.USER,
    );
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async drain(): Promise<void> {
    // Guard against overlap when a batch takes longer than the interval.
    if (this.draining) return;
    this.draining = true;

    try {
      await this.locks.withLock(
        `lock:outbox:${ServiceNames.USER}`,
        async () => {
          const published = await this.drainer.drain();
          if (published > 0) this.logger.debug(`published ${published} outbox events`);
        },
        { ttlSeconds: 30 },
      );
    } catch (error) {
      this.logger.error(`outbox drain failed: ${(error as Error).message}`);
    } finally {
      this.draining = false;
    }
  }

  /** Keeps the outbox table small so the drainer's index stays hot. */
  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    await this.locks.withLock(`lock:outbox-purge:${ServiceNames.USER}`, async () => {
      const removed = await this.drainer.purgePublished();
      if (removed > 0) this.logger.log(`purged ${removed} published outbox rows`);
    });
  }
}
