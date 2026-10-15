import { Injectable, Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AppException, ErrorCode, generateSku, uniqueSlug } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  CacheTtl,
  KafkaTopics,
  Paginated,
  ProductStatus,
  RequestContext,
  STAFF_ROLES,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/catalog';
import { HttpStatus } from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  ReviewProductDto,
  SearchProductsDto,
  UpdateProductDto,
  VariantInputDto,
} from '@ecommerce/contracts';

/**
 * Products and variants.
 *
 * A product is created with all of its variants in one transaction: a product with no
 * buyable variant is not a product, and allowing that intermediate state would let it
 * reach a listing page as an unpurchasable card.
 *
 * `minPrice`/`maxPrice` are denormalised onto the product from its variants. Listing
 * pages sort and filter by price across thousands of rows, and doing that through a join
 * to variants makes the query an order of magnitude slower.
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly cache: CacheService,
  ) {}

  async create(
    vendor: { id: string; name: string; code: string },
    dto: CreateProductDto,
    ctx: RequestContext,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw AppException.notFound('Category', dto.categoryId);

    if (dto.variants.length === 0) {
      throw AppException.validation('A product needs at least one variant');
    }
    this.assertVariantPricing(dto.variants);

    const slug = uniqueSlug(dto.title);
    const prices = dto.variants.map((variant) => variant.price);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          vendorId: vendor.id,
          vendorName: vendor.name,
          // Same convention as Order.source: who actually made the call, read off the
          // request context rather than trusted from the body - a vendor cannot claim
          // ADMIN_WEB by sending it in the DTO.
          source: ctx.source ?? 'API',
          title: dto.title,
          slug,
          description: dto.description,
          highlights: dto.highlights ?? [],
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          status: dto.submitForReview ? ProductStatus.PENDING_REVIEW : ProductStatus.DRAFT,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          taxBps: category.taxBps,
          specifications: dto.specifications as never,
          searchKeywords: dto.searchKeywords ?? [],
          isReturnable: dto.isReturnable ?? true,
          returnWindowDays: dto.returnWindowDays ?? 7,
          isCodAvailable: dto.isCodAvailable ?? true,
          externalSource: dto.externalSource,
          externalProductId: dto.externalProductId,
          variants: {
            create: dto.variants.map((variant, index) => ({
              sku:
                variant.sku ??
                generateSku({
                  vendorCode: vendor.code,
                  // The last 8 chars carry uniqueSlug's random suffix - the title
                  // prefix alone repeats across similarly-named products and this
                  // SKU has no DB-level uniqueness retry, so it must be collision-free
                  // on the first attempt.
                  productCode: slug.slice(-8),
                  variantCode: `${index + 1}`.padStart(3, '0'),
                }),
              title: variant.title,
              options: variant.options as never,
              mrp: variant.mrp,
              price: variant.price,
              barcode: variant.barcode,
              weightGrams: variant.weightGrams,
              imageUrl: variant.imageUrl,
              // Exactly one default variant - the one the product page opens on.
              isDefault: variant.isDefault ?? index === 0,
            })),
          },
          media: {
            create: (dto.imageUrls ?? []).map((url, index) => ({
              url,
              displayOrder: index,
            })),
          },
        },
        include: { variants: true, media: true },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.PRODUCT_CREATED,
          partitionKey: created.id,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            productId: created.id,
            vendorId: vendor.id,
            slug: created.slug,
            title: created.title,
            categoryId: created.categoryId,
            status: created.status,
            variantIds: created.variants.map((variant) => variant.id),
          },
        }),
      });

      return created;
    });

    this.logger.log(`product ${product.id} created by vendor ${vendor.id}`);
    return product;
  }

  async update(productId: string, vendorId: string | null, dto: UpdateProductDto, ctx: RequestContext) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!existing) throw AppException.notFound('Product', productId);

    // A vendor may only touch their own catalogue; staff pass `null` and bypass this.
    if (vendorId && existing.vendorId !== vendorId) {
      throw AppException.forbidden('You can only edit your own products');
    }

    if (dto.variants) this.assertVariantPricing(dto.variants);

    const prices = dto.variants?.map((variant) => variant.price) ?? [];

    const product = await this.prisma.$transaction(async (tx) => {
      // Edit forms submit the full current set, not a diff - replace rather than merge.
      if (dto.variants) await tx.productVariant.deleteMany({ where: { productId } });
      if (dto.imageUrls) await tx.productMedia.deleteMany({ where: { productId } });

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          title: dto.title,
          description: dto.description,
          highlights: dto.highlights,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          specifications: dto.specifications as never,
          searchKeywords: dto.searchKeywords,
          isReturnable: dto.isReturnable,
          returnWindowDays: dto.returnWindowDays,
          isCodAvailable: dto.isCodAvailable,
          externalSource: dto.externalSource,
          externalProductId: dto.externalProductId,
          ...(prices.length > 0
            ? { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) }
            : {}),
          // Any edit to a live product goes back through review, so a vendor cannot
          // swap an approved listing for something else after the fact.
          ...(existing.status === ProductStatus.ACTIVE && dto.submitForReview !== false
            ? { status: ProductStatus.PENDING_REVIEW }
            : {}),
          ...(dto.variants
            ? {
                variants: {
                  create: dto.variants.map((variant, index) => ({
                    sku:
                      variant.sku ??
                      generateSku({
                        vendorCode: existing.vendorId,
                        productCode: existing.slug.slice(-8),
                        variantCode: `${index + 1}`.padStart(3, '0'),
                      }),
                    title: variant.title,
                    options: variant.options as never,
                    mrp: variant.mrp,
                    price: variant.price,
                    barcode: variant.barcode,
                    weightGrams: variant.weightGrams,
                    imageUrl: variant.imageUrl,
                    isDefault: variant.isDefault ?? index === 0,
                  })),
                },
              }
            : {}),
          ...(dto.imageUrls
            ? {
                media: {
                  create: dto.imageUrls.map((url, index) => ({ url, displayOrder: index })),
                },
              }
            : {}),
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.PRODUCT_UPDATED,
          partitionKey: productId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            productId,
            vendorId: existing.vendorId,
            slug: updated.slug,
            title: updated.title,
            categoryId: updated.categoryId,
            status: updated.status,
            variantIds: existing.variants.map((variant) => variant.id),
          },
        }),
      });

      return updated;
    });

    await this.invalidateProduct(productId, existing.slug);
    return product;
  }

  /** Admin approval. Publishing is what makes a product visible to customers. */
  async review(productId: string, dto: ReviewProductDto, ctx: RequestContext) {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw AppException.notFound('Product', productId);

    if (existing.status !== ProductStatus.PENDING_REVIEW) {
      throw AppException.conflict(`Product is ${existing.status}, not awaiting review`);
    }

    const approved = dto.status === ProductStatus.ACTIVE;

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          status: dto.status,
          rejectionReason: approved ? null : dto.reason,
          approvedBy: ctx.userId,
          publishedAt: approved ? (existing.publishedAt ?? new Date()) : null,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: approved ? KafkaTopics.PRODUCT_PUBLISHED : KafkaTopics.PRODUCT_ARCHIVED,
          partitionKey: productId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            productId,
            vendorId: updated.vendorId,
            slug: updated.slug,
            title: updated.title,
            categoryId: updated.categoryId,
            status: updated.status,
            variantIds: [],
          },
        }),
      });

      return updated;
    });

    await this.invalidateProduct(productId, existing.slug);
    return product;
  }

  /**
   * Reads a product for the detail page.
   *
   * Cached aggressively: this is the single most-hit endpoint in a commerce app, and
   * product copy changes rarely. Availability is deliberately not included - it changes
   * constantly and is fetched separately from inventory-service.
   */
  /** Accepts either the product id or its slug - storefront URLs are slug-based,
   *  everything else (cart, orders, admin) already holds the id. */
  async getById(idOrSlug: string, options: { includeUnpublished?: boolean } = {}) {
    const product = await this.cache.wrap(
      CacheKeys.product(idOrSlug),
      () =>
        this.prisma.product.findUnique({
          where: isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
          include: {
            variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
            media: { orderBy: { displayOrder: 'asc' } },
            category: { select: { id: true, name: true, slug: true, path: true } },
            brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        }),
      { ttlSeconds: CacheTtl.PRODUCT },
    );

    if (!product) throw AppException.notFound('Product', idOrSlug);

    if (!options.includeUnpublished && product.status !== ProductStatus.ACTIVE) {
      // Same error as a missing product: an unlisted draft should not be discoverable.
      throw AppException.notFound('Product', idOrSlug);
    }

    return product;
  }

  /**
   * Bulk variant lookup used by cart and order to price a basket in one round trip
   * instead of one call per line.
   */
  async resolveVariants(variantIds: string[]) {
    if (variantIds.length === 0) return [];

    return this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      select: {
        id: true,
        sku: true,
        title: true,
        options: true,
        mrp: true,
        price: true,
        imageUrl: true,
        product: {
          select: {
            id: true,
            title: true,
            status: true,
            vendorId: true,
            vendorName: true,
            taxBps: true,
            isReturnable: true,
            isCodAvailable: true,
            media: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
          },
        },
      },
    });
  }

  /**
   * Catalogue search and filtering.
   *
   * Postgres does the work here: `searchKeywords` plus trigram-friendly ILIKE covers a
   * catalogue in the low millions when paired with the composite indexes on the model.
   * Beyond that, this method is the seam where an Elasticsearch or OpenSearch read model
   * gets swapped in - the signature does not change.
   */
  async search(dto: SearchProductsDto): Promise<Paginated<unknown>> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));

    const categoryIds =
      dto.categoryId && dto.includeSubcategories !== false
        ? await this.categories.descendantIds(dto.categoryId)
        : dto.categoryId
          ? [dto.categoryId]
          : undefined;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(dto.brandId ? { brandId: dto.brandId } : {}),
      ...(dto.vendorId ? { vendorId: dto.vendorId } : {}),
      ...(dto.minRating ? { ratingAverage: { gte: dto.minRating } } : {}),
      ...(dto.minPrice !== undefined || dto.maxPrice !== undefined
        ? {
            minPrice: {
              ...(dto.maxPrice !== undefined ? { lte: dto.maxPrice } : {}),
            },
            maxPrice: {
              ...(dto.minPrice !== undefined ? { gte: dto.minPrice } : {}),
            },
          }
        : {}),
      ...(dto.q
        ? {
            OR: [
              { title: { contains: dto.q, mode: 'insensitive' } },
              { searchKeywords: { has: dto.q.toLowerCase() } },
              { vendorName: { contains: dto.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: this.orderFor(dto.sort),
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          minPrice: true,
          maxPrice: true,
          ratingAverage: true,
          ratingCount: true,
          vendorId: true,
          vendorName: true,
          isCodAvailable: true,
          media: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
          variants: {
            take: 1,
            where: { isDefault: true },
            select: { id: true, sku: true, price: true, mrp: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Cross-vendor, cross-status listing for the admin console.
   *
   * `search()` hardcodes `ACTIVE` because it is the public storefront query - a
   * PENDING_REVIEW or REJECTED product must never be discoverable there. Admins need
   * the opposite default: everything except a vendor's untouched DRAFT work, so the
   * review queue (PENDING_REVIEW) and moderation history (REJECTED/ARCHIVED) are both
   * visible without an extra round trip per status.
   */
  async adminSearch(query: {
    page?: number;
    limit?: number;
    q?: string;
    status?: ProductStatus;
    vendorId?: string;
    categoryId?: string;
  }): Promise<Paginated<unknown>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.ProductWhereInput = {
      status: query.status ?? { not: ProductStatus.DRAFT },
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { vendorName: { contains: query.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          vendorId: true,
          vendorName: true,
          source: true,
          externalSource: true,
          externalProductId: true,
          categoryId: true,
          minPrice: true,
          maxPrice: true,
          ratingAverage: true,
          ratingCount: true,
          soldCount: true,
          rejectionReason: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          media: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
          variants: { select: { id: true, sku: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Product counts grouped by status, for the admin dashboard's status chart
   * - one query instead of one `limit=1` filtered list call per status.
   * Cached briefly and stampede-protected the same way order summary/trend
   * are; see the note there for why.
   */
  async adminSummary(): Promise<{ status: ProductStatus; count: number }[]> {
    return this.cache.wrap(
      CacheKeys.adminSummary('products'),
      async () => {
        const rows = await this.prisma.product.groupBy({
          by: ['status'],
          _count: { _all: true },
        });
        return rows.map((row) => ({ status: row.status, count: row._count._all }));
      },
      { ttlSeconds: CacheTtl.ADMIN_SUMMARY },
    );
  }

  async listForVendor(vendorId: string, query: { page?: number; limit?: number; status?: ProductStatus }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.ProductWhereInput = {
      vendorId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { variants: { select: { id: true, sku: true, price: true, title: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async archive(productId: string, vendorId: string | null, ctx: RequestContext) {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw AppException.notFound('Product', productId);
    if (vendorId && existing.vendorId !== vendorId) {
      throw AppException.forbidden('You can only archive your own products');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { status: ProductStatus.ARCHIVED },
      });
      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.PRODUCT_ARCHIVED,
          partitionKey: productId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: { productId, vendorId: existing.vendorId, status: ProductStatus.ARCHIVED },
        }),
      });
    });

    await this.invalidateProduct(productId, existing.slug);
    return { ok: true as const };
  }

  /** Keeps `vendorName` current when a seller renames their business. */
  async syncVendorName(vendorId: string, vendorName: string): Promise<void> {
    const { count } = await this.prisma.product.updateMany({
      where: { vendorId },
      data: { vendorName },
    });
    if (count > 0) {
      await this.cache.invalidatePattern('catalog:product:*');
      this.logger.log(`renamed vendor on ${count} products`);
    }
  }

  private orderFor(sort: SearchProductsDto['sort']): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ minPrice: 'asc' }, { id: 'asc' }];
      case 'price_desc':
        return [{ minPrice: 'desc' }, { id: 'asc' }];
      case 'newest':
        return [{ publishedAt: 'desc' }, { id: 'asc' }];
      case 'rating':
        return [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }];
      case 'popular':
        return [{ soldCount: 'desc' }, { id: 'asc' }];
      default:
        // "Relevance" without a search engine: popularity, then rating. Adding `id` last
        // keeps pagination stable when two products tie.
        return [{ soldCount: 'desc' }, { ratingAverage: 'desc' }, { id: 'asc' }];
    }
  }

  private assertVariantPricing(variants: VariantInputDto[]): void {
    for (const variant of variants) {
      if (variant.price > variant.mrp) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          `Variant "${variant.title}": selling price cannot exceed the MRP`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async invalidateProduct(productId: string, slug: string): Promise<void> {
    await this.cache.invalidate(CacheKeys.product(productId), CacheKeys.productBySlug(slug));
  }
}
