import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@ecom-db/recommendation';
import {
  CacheKeys,
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderCreatedPayload,
  ProductLifecyclePayload,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService, RedisService } from '@ecommerce/redis';
import { IngestService, type PairIncrement } from '../engine/ingest.service';
import {
  DAY_SECONDS,
  SAME_ORDER_PAIR_WEIGHT,
  SEQUENTIAL_PAIR_WEIGHT,
  SEQUENTIAL_PURCHASE_WINDOW_DAYS,
} from '../engine/tuning';
import { PrismaService } from '../prisma/prisma.service';

const GROUP = ConsumerGroups.RECOMMENDATION_LEARN;

/**
 * Learns from the platform's own event stream - its own consumer group, so it reads
 * the same Kafka topics as order/notification services without ever slowing them:
 * if this service is down or behind, Kafka simply holds its offset and it catches up.
 *
 *  - catalog product events keep the local ProductProjection (category, status) fresh;
 *  - ORDER_CONFIRMED is the purchase signal. Confirmed, not created: an order that
 *    never got paid is not evidence that two things go together.
 */
@Injectable()
export class LearnConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(LearnConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
    private readonly idempotency: IdempotencyService,
    private readonly redis: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const product = (envelope: unknown) =>
      this.once(envelope as EventEnvelope, () => this.onProduct(envelope as EventEnvelope<ProductLifecyclePayload>));

    await this.consumer.subscribe(
      {
        groupId: GROUP,
        topics: [
          KafkaTopics.PRODUCT_CREATED,
          KafkaTopics.PRODUCT_UPDATED,
          KafkaTopics.PRODUCT_PUBLISHED,
          KafkaTopics.PRODUCT_ARCHIVED,
          KafkaTopics.ORDER_CONFIRMED,
        ],
        partitionConcurrency: 2,
        maxRetries: 3,
      },
      {
        [KafkaTopics.PRODUCT_CREATED]: product,
        [KafkaTopics.PRODUCT_UPDATED]: product,
        [KafkaTopics.PRODUCT_PUBLISHED]: product,
        [KafkaTopics.PRODUCT_ARCHIVED]: product,
        [KafkaTopics.ORDER_CONFIRMED]: (envelope) =>
          this.once(envelope as EventEnvelope, () =>
            this.onOrderConfirmed(envelope as EventEnvelope<OrderCreatedPayload>),
          ),
      },
    );
  }

  private async onProduct({ payload }: EventEnvelope<ProductLifecyclePayload>) {
    await this.prisma.productProjection.upsert({
      where: { id: payload.productId },
      create: { id: payload.productId, categoryId: payload.categoryId, status: payload.status },
      update: { categoryId: payload.categoryId, status: payload.status },
    });
  }

  /**
   * One confirmed order teaches three things:
   *  1. a PURCHASE interaction per product (feeds popularity + the buyer's interests);
   *  2. same-order pairs  - "frequently bought together", the strongest evidence;
   *  3. sequential pairs with what this buyer purchased in the last 30 days - the AC
   *     this week and the AC cover next week are complements too, just not in one cart.
   * Plus the category-level version of 2+3, which gives brand-new products complements
   * before they have any history of their own.
   */
  private async onOrderConfirmed({ payload, occurredAt }: EventEnvelope<OrderCreatedPayload>) {
    const userKey = `u:${payload.userId}`;
    const at = new Date(occurredAt ?? Date.now());
    const productIds = [...new Set(payload.lines.map((line) => line.productId))];
    if (productIds.length === 0) return;

    const since = new Date(at.getTime() - SEQUENTIAL_PURCHASE_WINDOW_DAYS * DAY_SECONDS * 1000);
    const earlier = await this.prisma.interaction.findMany({
      where: { userKey, kind: 'PURCHASE', occurredAt: { gte: since }, productId: { notIn: productIds } },
      select: { productId: true },
      distinct: ['productId'],
    });

    const pairs: PairIncrement[] = [];
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        pairs.push({ kind: 'CO_PURCHASE', a: productIds[i], b: productIds[j], weight: SAME_ORDER_PAIR_WEIGHT });
      }
      for (const prior of earlier) {
        pairs.push({ kind: 'CO_PURCHASE', a: productIds[i], b: prior.productId, weight: SEQUENTIAL_PAIR_WEIGHT });
      }
    }

    await this.ingest.applyNow(
      productIds.map((productId) => ({ userKey, productId, kind: 'PURCHASE' as const, at })),
      pairs,
    );
    await this.bumpCategoryPairs(productIds, earlier.map((row) => row.productId));
  }

  private async bumpCategoryPairs(orderProducts: string[], priorProducts: string[]) {
    const rows = await this.prisma.productProjection.findMany({
      where: { id: { in: [...orderProducts, ...priorProducts] } },
      select: { id: true, categoryId: true },
    });
    const categoryOf = new Map(rows.map((row) => [row.id, row.categoryId]));
    const orderCats = [...new Set(orderProducts.map((id) => categoryOf.get(id)).filter(Boolean))] as string[];
    const priorCats = [...new Set(priorProducts.map((id) => categoryOf.get(id)).filter(Boolean))] as string[];

    const weights = new Map<string, number>();
    const add = (a: string, b: string, weight: number) => {
      if (a === b) return;
      for (const key of [`${a}|${b}`, `${b}|${a}`]) weights.set(key, (weights.get(key) ?? 0) + weight);
    };
    orderCats.forEach((a, i) => orderCats.slice(i + 1).forEach((b) => add(a, b, SAME_ORDER_PAIR_WEIGHT)));
    orderCats.forEach((a) => priorCats.forEach((b) => add(a, b, SEQUENTIAL_PAIR_WEIGHT)));
    if (weights.size === 0) return;

    const values = [...weights].map(([key, weight]) => {
      const [a, b] = key.split('|');
      return Prisma.sql`(${a}::uuid, ${b}::uuid, ${weight}::float8, now())`;
    });
    await this.prisma.$executeRaw`
      INSERT INTO "category_pairs" ("categoryA", "categoryB", "count", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("categoryA", "categoryB") DO UPDATE SET
        "count" = "category_pairs"."count" + EXCLUDED."count", "updatedAt" = now()`;
  }

  /**
   * Kafka is at-least-once: apply each event exactly once (Redis fast path + DB record).
   * The Redis marker is set before the handler runs, so it is cleared again on failure
   * - otherwise the consumer's retry of a failed event would be skipped as a duplicate.
   */
  private async once(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    if (!(await this.idempotency.markEventProcessed(GROUP, envelope.eventId))) return;
    try {
      const applied = await this.prisma.processedEvent.findUnique({
        where: { eventId: envelope.eventId },
        select: { eventId: true },
      });
      if (applied) return;
      await handler();
      await this.prisma.processedEvent.create({ data: { eventId: envelope.eventId, consumerGroup: GROUP } });
    } catch (error) {
      await this.redis.del(CacheKeys.processedEvent(GROUP, envelope.eventId));
      this.logger.warn(`${envelope.eventType} ${envelope.eventId} failed, will retry: ${(error as Error).message}`);
      throw error;
    }
  }
}
