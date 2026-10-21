import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** A product needs this many views before its conversion counts toward a category average. */
const MIN_VIEWS_FOR_BENCHMARK = 20;

/**
 * Engagement history for one product (admin "product insights"): what shoppers did
 * with it month by month, and how that compares with other products in its category.
 * Source: the interaction log (views/carts/wishlists, 180-day retention) and item_stats
 * (all-time counters) - both fed by storefront beacons and order events.
 */
@Injectable()
export class ProductActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async forProduct(productId: string, months: number) {
    const [monthly, window90, momentum, own, projection] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; kind: string; events: bigint; people: bigint }[]>`
        SELECT to_char(date_trunc('month', "occurredAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
               "kind"::text AS kind, count(*)::bigint AS events, count(DISTINCT "userKey")::bigint AS people
        FROM "interactions"
        WHERE "productId" = ${productId}::uuid
          AND "occurredAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - make_interval(months => ${months - 1}::int)
        GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ kind: string; events: bigint; people: bigint }[]>`
        SELECT "kind"::text AS kind, count(*)::bigint AS events, count(DISTINCT "userKey")::bigint AS people
        FROM "interactions"
        WHERE "productId" = ${productId}::uuid AND "occurredAt" >= now() - interval '90 days'
        GROUP BY 1`,
      this.prisma.$queryRaw<{ last30: bigint; prev30: bigint }[]>`
        SELECT count(*) FILTER (WHERE "occurredAt" >= now() - interval '30 days')::bigint AS last30,
               count(*) FILTER (WHERE "occurredAt" < now() - interval '30 days')::bigint AS prev30
        FROM "interactions"
        WHERE "productId" = ${productId}::uuid AND "kind" = 'VIEW' AND "occurredAt" >= now() - interval '60 days'`,
      this.prisma.itemStat.findUnique({ where: { productId } }),
      this.prisma.productProjection.findUnique({ where: { id: productId } }),
    ]);

    const byKind = (rows: { kind: string; events: bigint; people: bigint }[], kind: string) => {
      const row = rows.find((item) => item.kind === kind);
      return { events: Number(row?.events ?? 0), people: Number(row?.people ?? 0) };
    };

    const series = new Map<string, { month: string; views: number; viewers: number; carts: number; wishlists: number }>();
    for (const row of monthly) {
      const entry = series.get(row.month) ?? { month: row.month, views: 0, viewers: 0, carts: 0, wishlists: 0 };
      if (row.kind === 'VIEW') {
        entry.views = Number(row.events);
        entry.viewers = Number(row.people);
      } else if (row.kind === 'CART') entry.carts = Number(row.events);
      else if (row.kind === 'WISHLIST') entry.wishlists = Number(row.events);
      series.set(row.month, entry);
    }

    return {
      categoryId: projection?.categoryId ?? null,
      monthly: [...series.values()].sort((a, b) => a.month.localeCompare(b.month)),
      last90: {
        views: byKind(window90, 'VIEW').events,
        viewers: byKind(window90, 'VIEW').people,
        carts: byKind(window90, 'CART').events,
        cartUsers: byKind(window90, 'CART').people,
        wishlists: byKind(window90, 'WISHLIST').events,
      },
      momentum: { viewsLast30: Number(momentum[0]?.last30 ?? 0), viewsPrev30: Number(momentum[0]?.prev30 ?? 0) },
      allTime: {
        views: own?.views ?? 0,
        carts: own?.carts ?? 0,
        wishlists: own?.wishlists ?? 0,
        purchases: own?.purchases ?? 0,
        trackingSince: await this.trackingSince(),
      },
      benchmark: projection?.categoryId ? await this.categoryBenchmark(projection.categoryId, productId) : null,
    };
  }

  /** Category averages over products with enough traffic to mean something. */
  private async categoryBenchmark(categoryId: string, productId: string) {
    const [stats] = await this.prisma.$queryRaw<
      { products: bigint; avg_views: number | null; cart_rate: number | null; buy_rate: number | null }[]
    >`
      SELECT count(*)::bigint AS products,
             avg(s."views")::float8 AS avg_views,
             (sum(s."carts")::float8 / nullif(sum(s."views"), 0)) AS cart_rate,
             (sum(s."purchases")::float8 / nullif(sum(s."views"), 0)) AS buy_rate
      FROM "item_stats" s
      JOIN "product_projection" p ON p."id" = s."productId"
      WHERE p."categoryId" = ${categoryId}::uuid AND p."status" = 'ACTIVE' AND s."views" >= ${MIN_VIEWS_FOR_BENCHMARK}::int`;
    const [rank] = await this.prisma.$queryRaw<{ position: bigint; total: bigint }[]>`
      WITH ranked AS (
        SELECT p."id", rank() OVER (ORDER BY coalesce(s."views", 0) DESC) AS position
        FROM "product_projection" p LEFT JOIN "item_stats" s ON s."productId" = p."id"
        WHERE p."categoryId" = ${categoryId}::uuid AND p."status" = 'ACTIVE'
      )
      SELECT (SELECT position FROM ranked WHERE "id" = ${productId}::uuid)::bigint AS position,
             (SELECT count(*) FROM ranked)::bigint AS total`;
    return {
      productsCompared: Number(stats?.products ?? 0),
      avgViews: stats?.avg_views ?? null,
      viewToCartRate: stats?.cart_rate ?? null,
      viewToOrderRate: stats?.buy_rate ?? null,
      viewsRank: rank?.position ? Number(rank.position) : null,
      productsInCategory: Number(rank?.total ?? 0),
    };
  }

  /** When engagement tracking started - older history simply doesn't exist. */
  private async trackingSince(): Promise<string | null> {
    const first = await this.prisma.interaction.findFirst({ orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } });
    return first?.occurredAt.toISOString() ?? null;
  }
}
