import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AppException, rpc } from '@ecommerce/common';
import { buildPaginationMeta, CacheKeys, CacheTtl, CatalogPatterns, ServiceTokens } from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { ToggleWishlistDto } from '@ecommerce/contracts';

interface ResolvedVariant {
  id: string;
  price: number;
  imageUrl: string | null;
  product: { id: string; title: string; media: { url: string }[] };
}

/**
 * Saved-for-later list.
 *
 * `priceAtSave` is stored so the app can show a "price dropped" badge by comparing
 * against the live price - no price-history table needed for the one comparison that
 * actually drives a purchase.
 */
@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ServiceTokens.CATALOG) private readonly catalog: ClientProxy,
    private readonly cache: CacheService,
  ) {}

  /**
   * Admin insights: products on the most wishlists right now, with how many of
   * those saves happened in the last `days` days - all-time demand vs. current
   * momentum. Counts distinct shoppers, so one person saving three variants of a
   * product is one save. Served by the `wishlist_items(productId)` index.
   */
  async topWishlisted(days: number) {
    return this.cache.wrap(
      CacheKeys.adminInsights('wishlist', days),
      async () => {
        const rows = await this.prisma.$queryRaw<
          { productId: string; title: string; imageUrl: string | null; saves: bigint; recent: bigint }[]
        >`
          SELECT "productId",
                 max("title") AS title,
                 max("imageUrl") AS "imageUrl",
                 count(DISTINCT "userId")::bigint AS saves,
                 count(DISTINCT "userId") FILTER (
                   WHERE "createdAt" >= now() - make_interval(days => ${days}::int)
                 )::bigint AS recent
          FROM "wishlist_items"
          GROUP BY "productId"
          ORDER BY saves DESC, recent DESC
          LIMIT 20
        `;
        const [totals] = await this.prisma.$queryRaw<{ saves: bigint; recent: bigint }[]>`
          SELECT count(*)::bigint AS saves,
                 count(*) FILTER (WHERE "createdAt" >= now() - make_interval(days => ${days}::int))::bigint AS recent
          FROM "wishlist_items"
        `;
        return {
          totals: { saves: Number(totals?.saves ?? 0), recent: Number(totals?.recent ?? 0) },
          top: rows.map((row) => ({
            productId: row.productId,
            title: row.title,
            imageUrl: row.imageUrl,
            saves: Number(row.saves),
            recent: Number(row.recent),
          })),
        };
      },
      { ttlSeconds: CacheTtl.ADMIN_INSIGHTS },
    );
  }

  async list(userId: string, query: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /** Adds when absent, removes when present - one endpoint for the heart icon. */
  async toggle(userId: string, dto: ToggleWishlistDto) {
    // `findFirst` rather than the compound unique: `variantId` is nullable, and Prisma's
    // generated compound-unique input does not accept null for it.
    const existing = await this.prisma.wishlistItem.findFirst({
      where: { userId, productId: dto.productId, variantId: dto.variantId ?? null },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { saved: false as const };
    }

    const variants = dto.variantId
      ? await rpc<ResolvedVariant[]>(this.catalog, CatalogPatterns.RESOLVE_VARIANTS, {
          variantIds: [dto.variantId],
        })
      : [];
    const variant = variants[0];

    const product = variant
      ? variant.product
      : await rpc<{ id: string; title: string; minPrice: number; media: { url: string }[] }>(
          this.catalog,
          CatalogPatterns.GET_PRODUCT,
          { productId: dto.productId },
        );

    if (!product) throw AppException.notFound('Product', dto.productId);

    await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId: dto.productId,
        variantId: dto.variantId,
        title: product.title,
        imageUrl: variant?.imageUrl ?? product.media?.[0]?.url,
        priceAtSave:
          variant?.price ??
          (product as { minPrice?: number }).minPrice ??
          0,
      },
    });

    return { saved: true as const };
  }
}
