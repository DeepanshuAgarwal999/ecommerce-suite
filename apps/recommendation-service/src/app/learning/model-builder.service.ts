import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '@ecommerce/redis';
import { FatigueService } from '../engine/fatigue.service';
import {
  CO_CART_IN_BOUGHT_TOGETHER,
  DAY_SECONDS,
  INTERACTION_RETENTION_DAYS,
  MIN_PAIR_SUPPORT,
  NEIGHBORS_PER_PRODUCT,
  POPULARITY_HALF_LIFE_DAYS,
} from '../engine/tuning';
import { PrismaService } from '../prisma/prisma.service';

const BUILD_EVERY_MS = 10 * 60 * 1000;
/** Arbitrary constant: the advisory-lock id that makes the build single-flight across replicas. */
const BUILD_LOCK_ID = 7_310_442;

/**
 * Turns raw co-occurrence counts into ready-to-serve recommendation lists.
 *
 * Item-to-item collaborative filtering (Amazon, 2003 - still the backbone of "bought
 * together" / "also viewed" at most large retailers): two products are related in
 * proportion to how often the same shoppers engage with both, normalised by how
 * popular each is on its own -
 *
 *     similarity(A, B) = co_count(A, B) / sqrt(count(A) * count(B))
 *
 * The normalisation is what stops a best-seller from showing up as "bought together"
 * with everything. Results are materialised as top-K rows per product so the read
 * path is one indexed lookup, never a computation.
 *
 * Runs every 10 minutes, entirely inside Postgres (set-based SQL, no rows shipped to
 * Node), under a transaction-scoped advisory lock so only one replica builds at a time.
 * Nothing on the request path waits for it - reads serve the last finished build.
 */
@Injectable()
export class ModelBuilderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModelBuilderService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fatigue: FatigueService,
    private readonly redis: RedisService,
  ) {}

  onApplicationBootstrap(): void {
    // First build shortly after boot (after the catalog backfill has had a head start).
    setTimeout(() => void this.build(), 20_000);
  }

  @Interval(BUILD_EVERY_MS)
  scheduled(): void {
    void this.build();
  }

  async build(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const started = Date.now();
    try {
      const built = await this.prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${BUILD_LOCK_ID}::bigint) AS locked`;
          if (!locked) return false;

          const halfLife = POPULARITY_HALF_LIFE_DAYS * DAY_SECONDS;

          // 1. Trending popularity: time-decayed engagement over the last 60 days.
          await tx.$executeRaw`
            UPDATE "item_stats" s SET "popularity" = x.score
            FROM (
              SELECT "productId", sum("weight" * exp(-ln(2) * extract(epoch FROM now() - "occurredAt") / ${halfLife}::float8)) AS score
              FROM "interactions"
              WHERE "occurredAt" > now() - interval '60 days'
              GROUP BY "productId"
            ) x
            WHERE x."productId" = s."productId"`;
          await tx.$executeRaw`
            UPDATE "item_stats" SET "popularity" = 0
            WHERE "popularity" <> 0 AND "productId" NOT IN (
              SELECT DISTINCT "productId" FROM "interactions" WHERE "occurredAt" > now() - interval '60 days')`;

          // 2. "Frequently bought together": purchases, plus carts at a discount.
          await tx.$executeRaw`DELETE FROM "item_neighbors" WHERE "kind" = 'BOUGHT_TOGETHER'`;
          await tx.$executeRaw`
            WITH pair AS (
              SELECT "productA" AS a, "productB" AS b,
                     sum(CASE WHEN "kind" = 'CO_PURCHASE' THEN "count" ELSE "count" * ${CO_CART_IN_BOUGHT_TOGETHER}::float8 END) AS c
              FROM "item_pairs" WHERE "kind" IN ('CO_PURCHASE', 'CO_CART')
              GROUP BY 1, 2
            ),
            stat AS (
              SELECT "productId" AS id, greatest("purchases" + "carts" * ${CO_CART_IN_BOUGHT_TOGETHER}::float8, 1) AS n
              FROM "item_stats"
            ),
            ranked AS (
              SELECT pair.a, pair.b, pair.c / sqrt(sa.n * sb.n) AS score,
                     row_number() OVER (PARTITION BY pair.a ORDER BY pair.c / sqrt(sa.n * sb.n) DESC, pair.b) AS rk
              FROM pair
              JOIN stat sa ON sa.id = pair.a
              JOIN stat sb ON sb.id = pair.b
              JOIN "product_projection" pp ON pp."id" = pair.b AND pp."status" = 'ACTIVE'
              WHERE pair.c >= ${MIN_PAIR_SUPPORT}::float8
            )
            INSERT INTO "item_neighbors" ("productId", "kind", "neighborId", "score", "rank")
            SELECT a, 'BOUGHT_TOGETHER', b, score, rk FROM ranked WHERE rk <= ${NEIGHBORS_PER_PRODUCT}::int`;

          // 3. "Customers who viewed this also viewed".
          await tx.$executeRaw`DELETE FROM "item_neighbors" WHERE "kind" = 'ALSO_VIEWED'`;
          await tx.$executeRaw`
            WITH ranked AS (
              SELECT p."productA" AS a, p."productB" AS b,
                     p."count" / sqrt(greatest(sa."views", 1) * greatest(sb."views", 1)) AS score,
                     row_number() OVER (
                       PARTITION BY p."productA"
                       ORDER BY p."count" / sqrt(greatest(sa."views", 1) * greatest(sb."views", 1)) DESC, p."productB"
                     ) AS rk
              FROM "item_pairs" p
              JOIN "item_stats" sa ON sa."productId" = p."productA"
              JOIN "item_stats" sb ON sb."productId" = p."productB"
              JOIN "product_projection" pp ON pp."id" = p."productB" AND pp."status" = 'ACTIVE'
              WHERE p."kind" = 'CO_VIEW' AND p."count" >= ${MIN_PAIR_SUPPORT}::float8
            )
            INSERT INTO "item_neighbors" ("productId", "kind", "neighborId", "score", "rank")
            SELECT a, 'ALSO_VIEWED', b, score, rk FROM ranked WHERE rk <= ${NEIGHBORS_PER_PRODUCT}::int`;

          // 4. Housekeeping.
          await tx.$executeRaw`
            DELETE FROM "interactions"
            WHERE "occurredAt" < now() - make_interval(days => ${INTERACTION_RETENTION_DAYS}::int)`;
          await tx.$executeRaw`DELETE FROM "processed_events" WHERE "processedAt" < now() - interval '14 days'`;
          return true;
        },
        { timeout: 120_000, maxWait: 10_000 },
      );

      if (!built) return;
      // 5. Impression fatigue: suppress ignored recommendations, release finished cool-offs.
      const fatigue = await this.fatigue.sweep();
      // Serve the new model immediately rather than after cache expiry.
      await this.redis.deleteByPattern('rec:out:*');
      this.logger.log(
        `model built in ${Date.now() - started}ms (fatigue: ${fatigue.suppressed} suppressed, ${fatigue.released} released)`,
      );
    } catch (error) {
      this.logger.warn(`model build failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
