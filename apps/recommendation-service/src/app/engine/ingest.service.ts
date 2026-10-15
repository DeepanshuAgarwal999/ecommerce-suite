import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InteractionKind, PairKind, Prisma } from '@ecom-db/recommendation';
import { RedisService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { FatigueService } from './fatigue.service';
import {
  AFFINITY_HALF_LIFE_DAYS,
  CO_CART_WINDOW_DAYS,
  DAY_SECONDS,
  INTERACTION_WEIGHT,
  SESSION_DEPTH,
  SESSION_WINDOW_SECONDS,
} from './tuning';

export interface ActivityEvent {
  userKey: string;
  productId: string;
  kind: InteractionKind;
  at: Date;
}

export interface PairIncrement {
  kind: PairKind;
  a: string;
  b: string;
  weight: number;
}

const FLUSH_EVERY_MS = 1000;
const FLUSH_AT_SIZE = 500;
/** Back-pressure: past this, drop the oldest - losing a few clicks beats running out of memory. */
const MAX_BUFFER = 20_000;

/**
 * The write side of the engine. Events are buffered in memory and applied in batches
 * every second (or every 500 events): one insert for the log, one upsert each for
 * item counters, category affinity and co-occurrence pairs - a handful of set-based
 * statements per batch instead of several round trips per click. That is what keeps
 * this service cheap enough to sit on the full clickstream.
 *
 * At-most-once by design for clicks: a crash loses up to one second of views, which
 * no recommendation can tell apart. Purchases (from Kafka) are applied through
 * `applyNow`, which writes immediately inside the consumer's idempotent handler.
 */
@Injectable()
export class IngestService implements OnModuleDestroy {
  private readonly logger = new Logger(IngestService.name);
  private buffer: ActivityEvent[] = [];
  private flushing: Promise<void> | null = null;
  private readonly timer = setInterval(() => void this.flush(), FLUSH_EVERY_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly fatigue: FatigueService,
  ) {}

  enqueue(event: ActivityEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
    if (this.buffer.length >= FLUSH_AT_SIZE) void this.flush();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  /** Apply now (purchases): same pipeline, no buffering, errors propagate to the caller. */
  async applyNow(events: ActivityEvent[], extraPairs: PairIncrement[] = []): Promise<void> {
    await this.apply(events, extraPairs);
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.flushing = this.apply(batch)
      .catch((error: unknown) => {
        this.logger.warn(`dropped ${batch.length} activity events: ${(error as Error).message}`);
      })
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  private async apply(events: ActivityEvent[], extraPairs: PairIncrement[] = []): Promise<void> {
    if (events.length === 0 && extraPairs.length === 0) return;

    // Category is looked up here, not trusted from the client.
    const productIds = [...new Set(events.map((event) => event.productId))];
    const projections = productIds.length
      ? await this.prisma.productProjection.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        })
      : [];
    const categoryOf = new Map(projections.map((row) => [row.id, row.categoryId]));

    const pairs = [...extraPairs, ...(await this.sessionPairs(events))];

    await this.prisma.$transaction(async (tx) => {
      if (events.length) {
        await tx.interaction.createMany({
          data: events.map((event) => ({
            userKey: event.userKey,
            productId: event.productId,
            categoryId: categoryOf.get(event.productId) ?? null,
            kind: event.kind,
            weight: INTERACTION_WEIGHT[event.kind],
            occurredAt: event.at,
          })),
        });
        await this.bumpItemStats(tx, events);
        await this.bumpAffinity(tx, events, categoryOf);
        await this.fatigue.markEngaged(tx, events);
      }
      await this.bumpPairs(tx, pairs);
    });
  }

  /** Per-product counters: one multi-row upsert. */
  private async bumpItemStats(tx: Prisma.TransactionClient, events: ActivityEvent[]) {
    const totals = new Map<string, { views: number; carts: number; wishlists: number; purchases: number }>();
    for (const event of events) {
      const row = totals.get(event.productId) ?? { views: 0, carts: 0, wishlists: 0, purchases: 0 };
      if (event.kind === 'VIEW') row.views++;
      else if (event.kind === 'CART') row.carts++;
      else if (event.kind === 'WISHLIST') row.wishlists++;
      else row.purchases++;
      totals.set(event.productId, row);
    }
    const values = [...totals].map(
      ([id, t]) => Prisma.sql`(${id}::uuid, ${t.views}, ${t.carts}, ${t.wishlists}, ${t.purchases}, now())`,
    );
    await tx.$executeRaw`
      INSERT INTO "item_stats" ("productId", "views", "carts", "wishlists", "purchases", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("productId") DO UPDATE SET
        "views" = "item_stats"."views" + EXCLUDED."views",
        "carts" = "item_stats"."carts" + EXCLUDED."carts",
        "wishlists" = "item_stats"."wishlists" + EXCLUDED."wishlists",
        "purchases" = "item_stats"."purchases" + EXCLUDED."purchases",
        "updatedAt" = now()`;
  }

  /**
   * Category interest with exponential time decay, applied in SQL: the stored score
   * is first decayed from its `updatedAt` to now, then this batch's weight is added.
   */
  private async bumpAffinity(
    tx: Prisma.TransactionClient,
    events: ActivityEvent[],
    categoryOf: Map<string, string | null>,
  ) {
    const totals = new Map<string, { userKey: string; categoryId: string; weight: number }>();
    for (const event of events) {
      const categoryId = categoryOf.get(event.productId);
      if (!categoryId) continue;
      const key = `${event.userKey}|${categoryId}`;
      const row = totals.get(key) ?? { userKey: event.userKey, categoryId, weight: 0 };
      row.weight += INTERACTION_WEIGHT[event.kind];
      totals.set(key, row);
    }
    if (totals.size === 0) return;
    const halfLifeSeconds = AFFINITY_HALF_LIFE_DAYS * DAY_SECONDS;
    const values = [...totals.values()].map(
      (row) => Prisma.sql`(${row.userKey}, ${row.categoryId}::uuid, ${row.weight}::float8, now())`,
    );
    await tx.$executeRaw`
      INSERT INTO "user_category_affinity" ("userKey", "categoryId", "score", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("userKey", "categoryId") DO UPDATE SET
        "score" = "user_category_affinity"."score"
                  * exp(-ln(2) * extract(epoch FROM now() - "user_category_affinity"."updatedAt") / ${halfLifeSeconds}::float8)
                  + EXCLUDED."score",
        "updatedAt" = now()`;
  }

  /** Co-occurrence counts, written in both directions. */
  private async bumpPairs(tx: Prisma.TransactionClient, pairs: PairIncrement[]) {
    const totals = new Map<string, PairIncrement>();
    for (const pair of pairs) {
      if (pair.a === pair.b) continue;
      for (const [a, b] of [
        [pair.a, pair.b],
        [pair.b, pair.a],
      ]) {
        const key = `${pair.kind}|${a}|${b}`;
        const row = totals.get(key) ?? { kind: pair.kind, a, b, weight: 0 };
        row.weight += pair.weight;
        totals.set(key, row);
      }
    }
    if (totals.size === 0) return;
    const values = [...totals.values()].map(
      (row) =>
        Prisma.sql`(${row.kind}::"PairKind", ${row.a}::uuid, ${row.b}::uuid, ${row.weight}::float8, now())`,
    );
    await tx.$executeRaw`
      INSERT INTO "item_pairs" ("kind", "productA", "productB", "count", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("kind", "productA", "productB") DO UPDATE SET
        "count" = "item_pairs"."count" + EXCLUDED."count",
        "updatedAt" = now()`;
  }

  /**
   * Co-view: each new view pairs with the other products this shopper viewed in the
   * same session (a Redis list per shopper that expires after 30 idle minutes).
   * Co-cart: each cart-add pairs with what they carted in the past week.
   */
  private async sessionPairs(events: ActivityEvent[]): Promise<PairIncrement[]> {
    const pairs: PairIncrement[] = [];

    for (const event of events.filter((item) => item.kind === 'VIEW')) {
      const key = `rec:session:${event.userKey}`;
      try {
        const recent = await this.redis.client.lrange(key, 0, SESSION_DEPTH - 1);
        for (const other of new Set(recent)) {
          if (other !== event.productId) {
            pairs.push({ kind: 'CO_VIEW', a: event.productId, b: other, weight: 1 });
          }
        }
        await this.redis.client
          .multi()
          .lrem(key, 0, event.productId)
          .lpush(key, event.productId)
          .ltrim(key, 0, SESSION_DEPTH - 1)
          .expire(key, SESSION_WINDOW_SECONDS)
          .exec();
      } catch {
        // Redis down: skip co-view for this event; everything else still lands.
      }
    }

    const carts = events.filter((item) => item.kind === 'CART');
    if (carts.length) {
      const since = new Date(Date.now() - CO_CART_WINDOW_DAYS * DAY_SECONDS * 1000);
      const earlier = await this.prisma.interaction.findMany({
        where: { kind: 'CART', userKey: { in: [...new Set(carts.map((item) => item.userKey))] }, occurredAt: { gte: since } },
        select: { userKey: true, productId: true },
        distinct: ['userKey', 'productId'],
      });
      for (const event of carts) {
        for (const other of earlier) {
          if (other.userKey === event.userKey && other.productId !== event.productId) {
            pairs.push({ kind: 'CO_CART', a: event.productId, b: other.productId, weight: 1 });
          }
        }
      }
    }
    return pairs;
  }
}
