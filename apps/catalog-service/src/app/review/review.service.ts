import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException, ErrorCode } from '@ecommerce/common';
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
    verified: { orderId: string; isVerifiedPurchase: boolean } = {
      orderId: '',
      isVerifiedPurchase: false,
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, status: true },
    });
    if (!product) throw AppException.notFound('Product', dto.productId);

    if (!dto.orderId) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'orderId is required: you can rate a product only after its order is delivered',
        HttpStatus.BAD_REQUEST,
      );
    }

    const review = await this.prisma.$transaction(async (tx) => {
      // Upsert on (productId, userId): a second submission edits the first rather than
      // letting one account stack ratings on the same product. An edit goes back to
      // pending moderation so changed text is re-approved before publishing.
      const existing = await tx.review.findUnique({
        where: { productId_userId: { productId: dto.productId, userId: user.id } },
        select: { id: true, orderId: true, isPublished: true },
      });

      const orderId = verified.orderId || dto.orderId;
      const isVerifiedPurchase = verified.isVerifiedPurchase === true;

      const saved =
        existing == null
          ? await tx.review.create({
              data: {
                productId: dto.productId,
                userId: user.id,
                userName: user.name,
                orderId,
                isVerifiedPurchase,
                rating: dto.rating,
                title: dto.title,
                comment: dto.comment,
                imageUrls: dto.imageUrls ?? [],
                isPublished: false, // Reviews must be approved by admin before publishing
              },
            })
          : await tx.review.update({
              where: { id: existing.id },
              data: {
                rating: dto.rating,
                title: dto.title,
                comment: dto.comment,
                imageUrls: dto.imageUrls ?? [],
                // Keep the original verified order: a buyer cannot move a review onto a
                // different order to fake the badge. Legacy unverified rows adopt it.
                ...(existing.orderId ? {} : { orderId, isVerifiedPurchase }),
                // Re-edits need re-approval before the new text goes live.
                isPublished: false,
              },
            });

      await this.recomputeProductRating(tx, dto.productId);

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

  /** Publish a pending review: sets the flag AND folds its stars into the product average. */
  async approveReview(user: { id: string; name: string }, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw AppException.notFound('Review', reviewId);
    }
    if (review.isPublished) return review;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.review.update({
        where: { id: reviewId },
        data: { isPublished: true },
      });
      await this.recomputeProductRating(tx, saved.productId);
      return saved;
    });

    await this.cache.invalidate(CacheKeys.product(updated.productId));
    this.logger.log(`Review ${reviewId} approved by ${user.id}; product ${updated.productId} rating recomputed`);
    return updated;
  }

  /** Unpublish a review: clears the flag AND removes its stars from the product average. */
  async rejectReview(user: { id: string; name: string }, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw AppException.notFound('Review', reviewId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.review.update({
        where: { id: reviewId },
        data: { isPublished: false },
      });
      await this.recomputeProductRating(tx, saved.productId);
      return saved;
    });

    await this.cache.invalidate(CacheKeys.product(updated.productId));
    this.logger.log(`Review ${reviewId} rejected by ${user.id}; product ${updated.productId} rating recomputed`);
    return updated;
  }

  /** Moderation queue: newest pending reviews first. */
  async listPending(query: { page?: number; limit?: number; productId?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const where = {
      isPublished: false,
      ...(query.productId ? { productId: query.productId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          productId: true,
          userId: true,
          userName: true,
          orderId: true,
          isVerifiedPurchase: true,
          rating: true,
          title: true,
          comment: true,
          imageUrls: true,
          createdAt: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /** The caller's own review for a product, if any (pre-fill + duplicate guard). */
  async getMyReview(productId: string, userId: string) {
    return this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        imageUrls: true,
        orderId: true,
        isVerifiedPurchase: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** Recompute ratingAverage/ratingCount from published reviews only. Runs inside the caller's transaction. */
  private async recomputeProductRating(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    productId: string,
  ) {
    const stats = await tx.review.aggregate({
      where: { productId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.product.update({
      where: { id: productId },
      data: {
        ratingAverage: Number((stats._avg.rating ?? 0).toFixed(2)),
        ratingCount: stats._count._all,
      },
    });
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
