import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  KafkaTopics,
  RequestContext,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from '@ecommerce/contracts';

/**
 * Product ratings and reviews.
 *
 * The product's `ratingAverage`/`ratingCount` are recomputed inside the same transaction
 * as the review write. Recomputing rather than incrementally adjusting costs one extra
 * aggregate query but means an edited or removed review can never leave the average
 * drifting away from the underlying rows.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(
    user: { id: string; name: string },
    dto: CreateReviewDto,
    ctx: RequestContext,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, status: true },
    });
    if (!product) throw AppException.notFound('Product', dto.productId);

    const review = await this.prisma.$transaction(async (tx) => {
      // Upsert on (productId, userId): a second submission edits the first rather than
      // letting one account stack ratings on the same product.
      const saved = await tx.review.upsert({
        where: { productId_userId: { productId: dto.productId, userId: user.id } },
        create: {
          productId: dto.productId,
          userId: user.id,
          userName: user.name,
          orderId: dto.orderId,
          isVerifiedPurchase: Boolean(dto.orderId),
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          imageUrls: dto.imageUrls ?? [],
        },
        update: {
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          imageUrls: dto.imageUrls ?? [],
          ...(dto.orderId ? { orderId: dto.orderId, isVerifiedPurchase: true } : {}),
        },
      });

      const stats = await tx.review.aggregate({
        where: { productId: dto.productId, isPublished: true },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: {
          ratingAverage: Number((stats._avg.rating ?? 0).toFixed(2)),
          ratingCount: stats._count._all,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.REVIEW_CREATED,
          partitionKey: dto.productId,
          correlationId: ctx.correlationId,
          actorId: user.id,
          payload: {
            reviewId: saved.id,
            productId: dto.productId,
            userId: user.id,
            rating: dto.rating,
            isVerifiedPurchase: saved.isVerifiedPurchase,
          },
        }),
      });

      return saved;
    });

    await this.cache.invalidate(CacheKeys.product(dto.productId));
    return review;
  }

  async list(productId: string, query: { page?: number; limit?: number; rating?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));

    const where = {
      productId,
      isPublished: true,
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const [items, total, breakdown] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        // Verified purchases first - they are the ones shoppers actually trust.
        orderBy: [{ isVerifiedPurchase: 'desc' }, { helpfulCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userName: true,
          rating: true,
          title: true,
          comment: true,
          imageUrls: true,
          isVerifiedPurchase: true,
          helpfulCount: true,
          createdAt: true,
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId, isPublished: true },
        orderBy: { rating: 'desc' },
        _count: { rating: true },
      }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
      // Star histogram for the rating bar on the product page. The groupBy result type
      // widens `_count` to a union, so narrow it once here rather than at each lookup.
      breakdown: [5, 4, 3, 2, 1].map((star) => ({
        rating: star,
        count:
          (breakdown as { rating: number; _count: { rating: number } }[]).find(
            (row) => row.rating === star,
          )?._count.rating ?? 0,
      })),
    };
  }
}
