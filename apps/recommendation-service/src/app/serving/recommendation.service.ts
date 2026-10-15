import { Injectable } from '@nestjs/common';
import { NeighborKind } from '@ecom-db/recommendation';
import { CacheService } from '@ecommerce/redis';
import { FatigueService } from '../engine/fatigue.service';
import { AFFINITY_HALF_LIFE_DAYS, DAY_SECONDS, decay } from '../engine/tuning';
import { PrismaService } from '../prisma/prisma.service';

/** Where a list came from - the storefront words its heading accordingly. */
export type ListSource = 'learned' | 'category' | 'trending' | 'personal' | 'none';

export interface ProductRecs {
  boughtTogether: string[];
  boughtTogetherSource: ListSource;
  alsoViewed: string[];
  similar: string[];
}

export interface UserRecs {
  recentlyViewed: string[];
  categoryIds: string[];
  recommended: string[];
  recommendedSource: ListSource;
}

/** Neighbour kinds blended into "picked for you", and how much each counts. */
const PERSONAL_BLEND: Record<NeighborKind, number> = { BOUGHT_TOGETHER: 1, ALSO_VIEWED: 0.7 };

/**
 * The read side: turns the materialised models into lists for one product, one cart,
 * or one shopper. Every list follows the same shape the big retailers use -
 *
 *   1. candidate generation  (learned neighbours, category complements, popularity)
 *   2. scoring / blending    (weighted by what the shopper did and how recently)
 *   3. filtering             (inactive products, things already bought, the item itself)
 *   4. re-ranking            (impression fatigue - see FatigueService)
 *   5. cold-start fallback   (category, then trending) so a list is never empty
 *                            just because there is no history yet.
 *
 * Shopper-independent parts are cached for 5 minutes; per-shopper filtering and
 * fatigue are applied on top on every read (two small indexed queries).
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly fatigue: FatigueService,
  ) {}

  // --- product page ------------------------------------------------------------

  async forProduct(productId: string, userKey: string | null): Promise<ProductRecs> {
    const base = await this.cache.wrap(
      `rec:out:p:${productId}`,
      () => this.productLists(productId),
      { ttlSeconds: 300 },
    );
    const purchased = await this.purchasedBy(userKey);
    const rerank = (ids: string[]) => this.applyFatigue(userKey, ids.filter((id) => !purchased.has(id)));

    const [boughtTogether, alsoViewedAll, similar] = await Promise.all([
      rerank(base.boughtTogether),
      rerank(base.alsoViewed),
      rerank(base.similar),
    ]);
    const inBundle = new Set(boughtTogether.slice(0, 6));
    const alsoViewed = alsoViewedAll.filter((id) => !inBundle.has(id));
    return {
      boughtTogether: boughtTogether.slice(0, 6),
      boughtTogetherSource: boughtTogether.length ? base.boughtTogetherSource : 'none',
      alsoViewed: alsoViewed.slice(0, 12),
      similar: similar.slice(0, 12),
    };
  }

  private async productLists(productId: string): Promise<ProductRecs> {
    const product = await this.prisma.productProjection.findUnique({ where: { id: productId } });
    const [learnedTogether, alsoViewed] = await Promise.all([
      this.neighbors([productId], 'BOUGHT_TOGETHER', 12),
      this.neighbors([productId], 'ALSO_VIEWED', 16),
    ]);

    // Cold start: not enough co-purchase history for this product yet - use what
    // buyers of its *category* go on to buy (AC -> AC covers, stands), most popular first.
    let boughtTogether = learnedTogether;
    let source: ListSource = learnedTogether.length ? 'learned' : 'none';
    if (learnedTogether.length < 3 && product?.categoryId) {
      const complements = await this.complementCategories([product.categoryId]);
      const filler = await this.popularIn(complements, [productId, ...learnedTogether], 8);
      boughtTogether = [...learnedTogether, ...filler];
      if (!learnedTogether.length && filler.length) source = 'category';
    }

    // Each product appears in one list only on a page: bundle > also viewed > similar.
    const similar = product?.categoryId
      ? await this.popularIn([product.categoryId], [productId, ...boughtTogether, ...alsoViewed], 16)
      : [];
    return { boughtTogether, boughtTogetherSource: source, alsoViewed, similar };
  }

  // --- cart ----------------------------------------------------------------------

  /** "You might also need": complements of everything in the cart, minus the cart. */
  async forCart(productIds: string[], userKey: string | null): Promise<{ productIds: string[]; source: ListSource }> {
    const inCart = [...new Set(productIds)].slice(0, 30);
    if (inCart.length === 0) return { productIds: [], source: 'none' };

    const scored = await this.prisma.itemNeighbor.findMany({
      where: { productId: { in: inCart }, kind: 'BOUGHT_TOGETHER', neighborId: { notIn: inCart } },
      select: { neighborId: true, score: true },
    });
    const totals = new Map<string, number>();
    // Summed across cart items: something that complements two things in the cart
    // outranks something that complements one.
    for (const row of scored) totals.set(row.neighborId, (totals.get(row.neighborId) ?? 0) + row.score);
    let ids = [...totals].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    let source: ListSource = ids.length ? 'learned' : 'none';

    if (ids.length < 6) {
      const categories = await this.prisma.productProjection.findMany({
        where: { id: { in: inCart }, categoryId: { not: null } },
        select: { categoryId: true },
      });
      const complements = await this.complementCategories(
        [...new Set(categories.map((row) => row.categoryId as string))],
      );
      const filler = await this.popularIn(complements, [...inCart, ...ids], 12);
      if (!ids.length && filler.length) source = 'category';
      ids = [...ids, ...filler];
    }

    const purchased = await this.purchasedBy(userKey);
    const ranked = await this.applyFatigue(userKey, ids.filter((id) => !purchased.has(id)));
    return { productIds: ranked.slice(0, 12), source: ranked.length ? source : 'none' };
  }

  // --- home page -------------------------------------------------------------------

  async forUser(userKey: string | null): Promise<UserRecs> {
    if (!userKey) return this.trendingOnly([]);
    return this.cache.wrap(`rec:out:u:${userKey}`, () => this.userLists(userKey), { ttlSeconds: 60 });
  }

  private async userLists(userKey: string): Promise<UserRecs> {
    const since = new Date(Date.now() - 30 * DAY_SECONDS * 1000);
    const [history, affinity, purchased] = await Promise.all([
      this.prisma.interaction.findMany({
        where: { userKey, occurredAt: { gte: since } },
        select: { productId: true, kind: true, weight: true, occurredAt: true },
        orderBy: { occurredAt: 'desc' },
        take: 500,
      }),
      this.prisma.userCategoryAffinity.findMany({ where: { userKey }, orderBy: { score: 'desc' }, take: 20 }),
      this.purchasedBy(userKey),
    ]);

    // Recently viewed, newest first, still live.
    const viewedOrder = [...new Set(history.filter((row) => row.kind === 'VIEW').map((row) => row.productId))];
    const recentlyViewed = await this.onlyActive(viewedOrder.slice(0, 20));

    // Category interest, decayed to now.
    const now = Date.now();
    const categories = affinity
      .map((row) => ({
        id: row.categoryId,
        score: row.score * decay((now - row.updatedAt.getTime()) / 1000, AFFINITY_HALF_LIFE_DAYS),
      }))
      .filter((row) => row.score > 0.5)
      .sort((a, b) => b.score - a.score);

    // Seeds: what this shopper engaged with, weighted by strength and recency.
    const seedScore = new Map<string, number>();
    for (const row of history) {
      const age = (now - row.occurredAt.getTime()) / 1000;
      seedScore.set(row.productId, (seedScore.get(row.productId) ?? 0) + row.weight * decay(age, AFFINITY_HALF_LIFE_DAYS));
    }
    const seeds = [...seedScore].sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (seeds.length === 0 && categories.length === 0) return this.trendingOnly(recentlyViewed);

    // Candidates 1: neighbours of the seeds ("because you viewed / bought ...").
    const candidates = new Map<string, number>();
    const neighbors = await this.prisma.itemNeighbor.findMany({
      where: { productId: { in: seeds.map(([id]) => id) }, rank: { lte: 10 } },
      select: { productId: true, neighborId: true, kind: true, score: true },
    });
    const seedWeight = new Map(seeds);
    for (const row of neighbors) {
      const add = (seedWeight.get(row.productId) ?? 0) * row.score * PERSONAL_BLEND[row.kind];
      candidates.set(row.neighborId, (candidates.get(row.neighborId) ?? 0) + add);
    }
    const maxNeighbor = Math.max(1e-9, ...candidates.values());
    for (const [id, score] of candidates) candidates.set(id, score / maxNeighbor);

    // Candidates 2: popular in favourite categories, in proportion to the interest.
    const topCats = categories.slice(0, 3);
    const catTotal = topCats.reduce((sum, row) => sum + row.score, 0) || 1;
    for (const cat of topCats) {
      const popular = await this.popularIn([cat.id], [], 10);
      popular.forEach((id, index) => {
        const add = 0.5 * (cat.score / catTotal) * (1 - index / 10);
        candidates.set(id, (candidates.get(id) ?? 0) + add);
      });
    }

    // Filter: not what they already engaged with or bought - that is "recently viewed".
    for (const id of [...seedScore.keys(), ...purchased]) candidates.delete(id);
    let recommended = await this.onlyActive([...candidates].sort((a, b) => b[1] - a[1]).map(([id]) => id));
    recommended = await this.applyFatigue(userKey, recommended);

    let source: ListSource = 'personal';
    if (recommended.length < 8) {
      const trending = await this.trending([...recommended, ...seedScore.keys(), ...purchased], 12);
      if (!recommended.length) source = 'trending';
      recommended = [...recommended, ...(await this.applyFatigue(userKey, trending))];
    }

    return {
      recentlyViewed: recentlyViewed.slice(0, 12),
      categoryIds: categories.slice(0, 6).map((row) => row.id),
      recommended: recommended.slice(0, 16),
      recommendedSource: source,
    };
  }

  private async trendingOnly(recentlyViewed: string[]): Promise<UserRecs> {
    const recommended = await this.trending(recentlyViewed, 16);
    return {
      recentlyViewed,
      categoryIds: [],
      recommended,
      recommendedSource: recommended.length ? 'trending' : 'none',
    };
  }

  // --- building blocks -------------------------------------------------------------

  private async neighbors(productIds: string[], kind: NeighborKind, take: number): Promise<string[]> {
    const rows = await this.prisma.itemNeighbor.findMany({
      where: { productId: { in: productIds }, kind },
      orderBy: [{ rank: 'asc' }],
      select: { neighborId: true },
      take,
    });
    return [...new Set(rows.map((row) => row.neighborId))];
  }

  /** Categories most often bought alongside these (cross-category only). */
  private async complementCategories(categoryIds: string[]): Promise<string[]> {
    if (!categoryIds.length) return [];
    const rows = await this.prisma.categoryPair.findMany({
      where: { categoryA: { in: categoryIds }, categoryB: { notIn: categoryIds } },
      orderBy: { count: 'desc' },
      take: 4,
      select: { categoryB: true },
    });
    return [...new Set(rows.map((row) => row.categoryB))];
  }

  /** Most popular live products in the given categories. */
  private async popularIn(categoryIds: string[], exclude: string[], take: number): Promise<string[]> {
    if (!categoryIds.length) return [];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT pp."id"
      FROM "product_projection" pp
      LEFT JOIN "item_stats" s ON s."productId" = pp."id"
      WHERE pp."status" = 'ACTIVE'
        AND pp."categoryId" = ANY(${categoryIds}::uuid[])
        AND NOT (pp."id" = ANY(${exclude}::uuid[]))
      ORDER BY coalesce(s."popularity", 0) DESC, coalesce(s."purchases", 0) DESC, coalesce(s."views", 0) DESC, pp."id"
      LIMIT ${take}::int`;
    return rows.map((row) => row.id);
  }

  /** Site-wide trending (time-decayed popularity) - the universal cold-start answer. */
  private async trending(exclude: string[], take: number): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT pp."id"
      FROM "product_projection" pp
      LEFT JOIN "item_stats" s ON s."productId" = pp."id"
      WHERE pp."status" = 'ACTIVE' AND NOT (pp."id" = ANY(${exclude}::uuid[]))
      ORDER BY coalesce(s."popularity", 0) DESC, coalesce(s."purchases", 0) DESC, pp."id"
      LIMIT ${take}::int`;
    return rows.map((row) => row.id);
  }

  private async onlyActive(ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const live = await this.prisma.productProjection.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true },
    });
    const set = new Set(live.map((row) => row.id));
    return ids.filter((id) => set.has(id));
  }

  private async purchasedBy(userKey: string | null): Promise<Set<string>> {
    if (!userKey) return new Set();
    const rows = await this.prisma.interaction.findMany({
      where: { userKey, kind: 'PURCHASE' },
      select: { productId: true },
      distinct: ['productId'],
    });
    return new Set(rows.map((row) => row.productId));
  }

  /** Re-rank by impression fatigue; suppressed products are dropped. Stable for ties. */
  private async applyFatigue(userKey: string | null, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const multipliers = await this.fatigue.multipliers(userKey, unique);
    if (multipliers.size === 0) return unique;
    // Position-based relevance (earlier = better) times fatigue.
    return unique
      .map((id, index) => ({ id, score: (1 / (index + 1)) * (multipliers.get(id) ?? 1) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.id);
  }
}
