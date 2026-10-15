import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { CacheKeys, CacheTtl } from '@ecommerce/contracts';
import { CacheService, RedisService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_N = 20;

/** YYYY-MM-DD in India time - "today" for an Indian storefront ends at IST midnight, not UTC. */
function istDay(epochMs: number): string {
  return new Date(epochMs + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `days` IST days, oldest first. */
function lastDays(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => istDay(now - (days - 1 - index) * DAY_MS));
}

/** "  Cushion   Covers " -> "cushion covers", so variants of one search count together. */
function normaliseTerm(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
}

/**
 * Storefront engagement analytics: product views and searches.
 *
 * Counted in Redis, not Postgres - the standard pattern for high-volume counters.
 * Each IST day gets a sorted set per metric (member = product id / search term,
 * score = count) plus a totals hash, all expiring after STATS_RETENTION. A view is
 * one pipelined ZINCRBY+HINCRBY (sub-millisecond, no row lock, no table bloat), and
 * "top N over the last 30 days" is a single ZUNIONSTORE over 30 small sets. If this
 * ever needs years of history or ad-hoc slicing, the next step is shipping these
 * events to a warehouse (ClickHouse/BigQuery) - the counters stay as the hot path.
 *
 * Events arrive from explicit storefront beacons rather than being inferred from
 * API reads, because the storefront caches product and search pages (ISR) - most
 * views never reach the API at all.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async trackView(productId: string): Promise<{ ok: true }> {
    const day = istDay(Date.now());
    await this.run('trackView', (pipe) =>
      pipe
        .zincrby(CacheKeys.statsViews(day), 1, productId)
        .expire(CacheKeys.statsViews(day), CacheTtl.STATS_RETENTION)
        .hincrby(CacheKeys.statsTotals(day), 'views', 1)
        .expire(CacheKeys.statsTotals(day), CacheTtl.STATS_RETENTION),
    );
    return { ok: true };
  }

  async trackSearch(rawTerm: string, results: number): Promise<{ ok: true }> {
    const term = normaliseTerm(rawTerm);
    if (term.length < 2) return { ok: true };
    const day = istDay(Date.now());

    await this.run('trackSearch', (pipe) => {
      pipe
        .zincrby(CacheKeys.statsSearches(day), 1, term)
        .expire(CacheKeys.statsSearches(day), CacheTtl.STATS_RETENTION)
        .hincrby(CacheKeys.statsTotals(day), 'searches', 1);
      if (results === 0) {
        pipe
          .zincrby(CacheKeys.statsZeroSearches(day), 1, term)
          .expire(CacheKeys.statsZeroSearches(day), CacheTtl.STATS_RETENTION)
          .hincrby(CacheKeys.statsTotals(day), 'zeroSearches', 1);
      }
      return pipe.expire(CacheKeys.statsTotals(day), CacheTtl.STATS_RETENTION);
    });
    return { ok: true };
  }

  /** Everything the admin Insights page needs from the storefront side, for the last `days` days. */
  async engagement(days: number) {
    return this.cache.wrap(
      CacheKeys.adminInsights('engagement', days),
      async () => {
        const dayKeys = lastDays(days);
        const [topViewed, topSearches, zeroResultSearches, series] = await Promise.all([
          this.topOver(dayKeys.map(CacheKeys.statsViews), 'views'),
          this.topOver(dayKeys.map(CacheKeys.statsSearches), 'searches'),
          this.topOver(dayKeys.map(CacheKeys.statsZeroSearches), 'zero'),
          this.dailyTotals(dayKeys),
        ]);

        const products = topViewed.length
          ? await this.prisma.product.findMany({
              where: { id: { in: topViewed.map((row) => row.member) } },
              select: {
                id: true,
                title: true,
                slug: true,
                minPrice: true,
                status: true,
                media: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
              },
            })
          : [];
        const byId = new Map(products.map((product) => [product.id, product]));

        const totals = series.reduce(
          (sum, day) => ({
            views: sum.views + day.views,
            searches: sum.searches + day.searches,
            zeroSearches: sum.zeroSearches + day.zeroSearches,
          }),
          { views: 0, searches: 0, zeroSearches: 0 },
        );

        return {
          totals,
          series,
          topSearches: topSearches.map((row) => ({ term: row.member, count: row.score })),
          zeroResultSearches: zeroResultSearches.map((row) => ({ term: row.member, count: row.score })),
          topViewed: topViewed.flatMap((row) => {
            const product = byId.get(row.member);
            // A product deleted since it was viewed has nothing to link to - drop it.
            if (!product) return [];
            return [
              {
                productId: product.id,
                title: product.title,
                slug: product.slug,
                status: product.status,
                price: product.minPrice,
                imageUrl: product.media[0]?.url ?? null,
                views: row.score,
              },
            ];
          }),
        };
      },
      { ttlSeconds: CacheTtl.ADMIN_INSIGHTS },
    );
  }

  /** Top members across several daily sorted sets: ZUNIONSTORE into a scratch key, read, drop. */
  private async topOver(keys: string[], name: string): Promise<{ member: string; score: number }[]> {
    const scratch = CacheKeys.statsScratch(`${name}:${randomUUID()}`);
    try {
      const raw = await this.redis.client
        .multi()
        .zunionstore(scratch, keys.length, ...keys)
        .zrevrange(scratch, 0, TOP_N - 1, 'WITHSCORES')
        .del(scratch)
        .exec();
      const flat = (raw?.[1]?.[1] as string[] | undefined) ?? [];
      const rows: { member: string; score: number }[] = [];
      for (let index = 0; index < flat.length; index += 2) {
        rows.push({ member: flat[index], score: Number(flat[index + 1]) });
      }
      return rows;
    } catch (error) {
      this.logger.warn(`topOver(${name}) failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async dailyTotals(dayKeys: string[]) {
    try {
      const pipe = this.redis.client.pipeline();
      dayKeys.forEach((day) => pipe.hgetall(CacheKeys.statsTotals(day)));
      const results = (await pipe.exec()) ?? [];
      return dayKeys.map((day, index) => {
        const hash = (results[index]?.[1] as Record<string, string> | undefined) ?? {};
        return {
          date: day,
          views: Number(hash['views'] ?? 0),
          searches: Number(hash['searches'] ?? 0),
          zeroSearches: Number(hash['zeroSearches'] ?? 0),
        };
      });
    } catch (error) {
      this.logger.warn(`dailyTotals failed: ${(error as Error).message}`);
      return dayKeys.map((date) => ({ date, views: 0, searches: 0, zeroSearches: 0 }));
    }
  }

  /** Tracking is best-effort: a Redis hiccup must never fail the shopper's request. */
  private async run(
    name: string,
    build: (pipe: ReturnType<RedisService['client']['pipeline']>) => unknown,
  ): Promise<void> {
    try {
      const pipe = this.redis.client.pipeline();
      build(pipe);
      await pipe.exec();
    } catch (error) {
      this.logger.warn(`${name} failed: ${(error as Error).message}`);
    }
  }
}
