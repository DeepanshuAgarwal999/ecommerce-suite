import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from '@ecommerce/auth';
import {
  CartRecommendationsQueryDto,
  CatalogPatterns,
  Headers as HeaderNames,
  RecommendationActivityDto,
  RecommendationPatterns,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

type ListSource = 'learned' | 'category' | 'trending' | 'personal' | 'none';

interface ProductRecs {
  boughtTogether: string[];
  boughtTogetherSource: ListSource;
  alsoViewed: string[];
  similar: string[];
}

interface UserRecs {
  recentlyViewed: string[];
  categoryIds: string[];
  recommended: string[];
  recommendedSource: ListSource;
}

/** The storefront's anonymous visitor id - see frontend/web lib/visitor.ts. */
const VISITOR_HEADER = HeaderNames.VISITOR_ID;

/**
 * Recommendations for the storefront.
 *
 * recommendation-service ranks product *ids*; this controller turns them into cards
 * with live data from catalog (price, image, stock status) in one batched call, so a
 * recommendation never shows a stale price or an archived product.
 *
 * Nothing here may break a page: every read is wrapped so a slow or down recommender
 * yields empty lists (the storefront then simply hides those rails), and activity is
 * emitted fire-and-forget.
 */
@ApiTags('recommendations')
@Controller('recs')
export class RecommendationController {
  private readonly logger = new Logger(RecommendationController.name);

  constructor(private readonly gateway: GatewayService) {}

  @OptionalAuth()
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Storefront beacon: view / cart / wishlist / recommendation impressions' })
  event(
    @Body() dto: RecommendationActivityDto,
    @CurrentUser('userId') userId: string | undefined,
    @Headers(VISITOR_HEADER) visitorId: string | undefined,
  ) {
    this.gateway.emitRecommendation(RecommendationPatterns.ACTIVITY, {
      ...dto,
      userId: userId ?? null,
      visitorId: visitorId ?? null,
      at: new Date().toISOString(),
    });
    return { accepted: true };
  }

  @OptionalAuth()
  @Get('products/:productId')
  @ApiOperation({ summary: 'Frequently bought together, customers also viewed, similar products' })
  async forProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser('userId') userId: string | undefined,
    @Headers(VISITOR_HEADER) visitorId: string | undefined,
  ) {
    const recs = await this.safely<ProductRecs>(
      RecommendationPatterns.FOR_PRODUCT,
      { productId, userId, visitorId },
      { boughtTogether: [], boughtTogetherSource: 'none', alsoViewed: [], similar: [] },
    );
    const cards = await this.cards([...recs.boughtTogether, ...recs.alsoViewed, ...recs.similar]);
    return {
      boughtTogether: { source: recs.boughtTogetherSource, items: this.pick(cards, recs.boughtTogether) },
      alsoViewed: { items: this.pick(cards, recs.alsoViewed) },
      similar: { items: this.pick(cards, recs.similar) },
    };
  }

  @OptionalAuth()
  @Get('cart')
  @ApiOperation({ summary: '"You might also need" for the products in a cart' })
  async forCart(
    @Query() { productIds }: CartRecommendationsQueryDto,
    @CurrentUser('userId') userId: string | undefined,
    @Headers(VISITOR_HEADER) visitorId: string | undefined,
  ) {
    const recs = await this.safely<{ productIds: string[]; source: ListSource }>(
      RecommendationPatterns.FOR_CART,
      { productIds, userId, visitorId },
      { productIds: [], source: 'none' },
    );
    const cards = await this.cards(recs.productIds);
    return { source: recs.source, items: this.pick(cards, recs.productIds) };
  }

  @OptionalAuth()
  @Get('for-you')
  @ApiOperation({ summary: 'Home page personalisation: recently viewed, favourite categories, picked for you' })
  async forYou(
    @CurrentUser('userId') userId: string | undefined,
    @Headers(VISITOR_HEADER) visitorId: string | undefined,
  ) {
    const recs = await this.safely<UserRecs>(
      RecommendationPatterns.FOR_USER,
      { userId, visitorId },
      { recentlyViewed: [], categoryIds: [], recommended: [], recommendedSource: 'none' },
    );
    const [cards, categories] = await Promise.all([
      this.cards([...recs.recentlyViewed, ...recs.recommended]),
      recs.categoryIds.length
        ? this.gateway
            .catalog<unknown[]>(CatalogPatterns.CATEGORY_CARDS, { categoryIds: recs.categoryIds })
            .catch(() => [])
        : Promise.resolve([]),
    ]);
    return {
      recentlyViewed: { items: this.pick(cards, recs.recentlyViewed) },
      categories: { items: categories },
      recommended: { source: recs.recommendedSource, items: this.pick(cards, recs.recommended) },
    };
  }

  private async safely<T>(pattern: string, payload: unknown, fallback: T): Promise<T> {
    try {
      return await this.gateway.recommendation<T>(pattern, payload);
    } catch (error) {
      this.logger.warn(`${pattern} unavailable, serving empty: ${(error as Error).message}`);
      return fallback;
    }
  }

  private async cards(ids: string[]): Promise<Map<string, unknown>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    try {
      const rows = await this.gateway.catalog<{ id: string }[]>(CatalogPatterns.PRODUCT_CARDS, { productIds: unique });
      return new Map(rows.map((row) => [row.id, row]));
    } catch {
      return new Map();
    }
  }

  /** Cards in ranked order; ids catalog no longer serves (archived) drop out. */
  private pick(cards: Map<string, unknown>, ids: string[]): unknown[] {
    return ids.map((id) => cards.get(id)).filter(Boolean);
  }
}
