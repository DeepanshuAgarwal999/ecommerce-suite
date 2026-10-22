import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, Public } from '@ecommerce/auth';
import { Ctx, PaginationQueryDto } from '@ecommerce/common';
import {
  AuthenticatedUser,
  CatalogPatterns,
  CreateReviewDto,
  InventoryPatterns,
  MerchandisingPatterns,
  OrderPatterns,
  OrderStatus,
  RecommendationPatterns,
  RequestContext,
  SearchProductsDto,
  SearchSuggestDto,
  ShippingEstimateDto,
  TrackProductViewDto,
  TrackSearchDto,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

/**
 * Public storefront reads.
 *
 * Everything here is `@Public()` except review creation. These are the highest-volume
 * routes in the platform and every one of them is served from Redis in the normal case;
 * the gateway adds nothing but auth (none) and validation.
 */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly gateway: GatewayService) {}

  @Public()
  @Get('home/banners')
  @ApiOperation({ summary: 'Active hero carousel slides, in display order' })
  homeBanners() {
    return this.gateway.catalog(MerchandisingPatterns.LIST_BANNERS, {});
  }

  @Public()
  @Get('home/sections')
  @ApiOperation({ summary: 'Active home page shelves (occasion/category tiles), each with its tiles' })
  homeSections() {
    return this.gateway.catalog(MerchandisingPatterns.LIST_HOME_SECTIONS, {});
  }

  @Public()
  @Get('home/theme')
  @ApiOperation({ summary: 'The occasion theme live right now (Diwali, Holi, ...), or null' })
  homeTheme() {
    return this.gateway.catalog(MerchandisingPatterns.ACTIVE_THEME, {});
  }

  @Public()
  @Get('footer')
  @ApiOperation({ summary: 'Footer link columns and settings (social, app links, copyright)' })
  footer() {
    return this.gateway.catalog(MerchandisingPatterns.GET_FOOTER, {});
  }

  @Public()
  @Get('categories/tree')
  @ApiOperation({ summary: 'Full category tree' })
  categoryTree() {
    return this.gateway.catalog(CatalogPatterns.CATEGORY_TREE, {});
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Categories at one level' })
  categories(@Query('parentId') parentId?: string) {
    return this.gateway.catalog(CatalogPatterns.LIST_CATEGORIES, { parentId });
  }

  @Public()
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Category detail' })
  category(@Param('slug') slug: string) {
    return this.gateway.catalog(CatalogPatterns.GET_CATEGORY, { slug });
  }

  @Public()
  @Get('brands')
  @ApiOperation({ summary: 'Brands' })
  brands(@Query('q') q?: string) {
    return this.gateway.catalog(CatalogPatterns.LIST_BRANDS, { q });
  }

  @OptionalAuth()
  @Post('track/view')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Storefront beacon: a product page was viewed (feeds admin Insights + recommendations)' })
  trackView(
    @Body() dto: TrackProductViewDto,
    @CurrentUser('userId') userId: string | undefined,
    @Headers('x-visitor-id') visitorId: string | undefined,
  ) {
    // One beacon, two consumers: the recommender learns from it fire-and-forget.
    this.gateway.emitRecommendation(RecommendationPatterns.ACTIVITY, {
      type: 'view',
      productId: dto.productId,
      userId: userId ?? null,
      visitorId: visitorId ?? null,
      at: new Date().toISOString(),
    });
    return this.gateway.catalog(CatalogPatterns.TRACK_PRODUCT_VIEW, dto);
  }

  @Public()
  @Post('track/search')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Storefront beacon: a search ran, with its result count (feeds admin Insights)' })
  trackSearch(@Body() dto: TrackSearchDto) {
    return this.gateway.catalog(CatalogPatterns.TRACK_SEARCH, dto);
  }

  @Public()
  @Get('search/suggest')
  @ApiOperation({ summary: 'Search-box type-ahead: matching categories and products for a partial term' })
  suggest(@Query() query: SearchSuggestDto) {
    return this.gateway.catalog(CatalogPatterns.SEARCH_SUGGEST, { q: query.q });
  }

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Search and filter products' })
  search(@Query() query: SearchProductsDto) {
    return this.gateway.catalog(CatalogPatterns.SEARCH_PRODUCTS, query);
  }

  @Public()
  @Get('products/:productId')
  @ApiOperation({ summary: 'Product detail (accepts the product id or its slug)' })
  product(@Param('productId') productId: string) {
    return this.gateway.catalog(CatalogPatterns.GET_PRODUCT, { productId });
  }

  @Public()
  @Get('shipping')
  @ApiOperation({ summary: 'Store delivery settings: base fee, free-delivery threshold, COD fee (admin-managed)' })
  shippingSettings() {
    return this.gateway.catalog(CatalogPatterns.GET_SHIPPING_SETTINGS, {});
  }

  @Public()
  @Post('shipping/estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delivery charge for a basket - same calculator as the order total' })
  shippingEstimate(@Body() dto: ShippingEstimateDto) {
    return this.gateway.catalog(CatalogPatterns.ESTIMATE_SHIPPING, dto);
  }

  @Public()
  @Get('products/:productId/delivery')
  @ApiOperation({ summary: 'The delivery rule that applies to one product (for the product page)' })
  productDelivery(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.gateway.catalog(CatalogPatterns.RESOLVE_SHIPPING, { productId });
  }

  @Public()
  @Get('products/:productId/availability')
  @ApiOperation({ summary: 'Live stock for every variant of a product' })
  async availability(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('pincode') pincode?: string,
  ) {
    // Two hops, but the second is one batched call - not one per variant.
    const product = await this.gateway.catalog<{ variants: { sku: string }[] }>(
      CatalogPatterns.GET_PRODUCT,
      { productId },
    );
    return this.gateway.inventory(InventoryPatterns.BULK_AVAILABILITY, {
      skus: product.variants.map((variant) => variant.sku),
      pincode,
    });
  }

  @Get('products/:productId/reviews/mine')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'My review for this product, if any' })
  myReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.gateway.catalog(CatalogPatterns.GET_MY_REVIEW, {
      productId,
      userId: user.userId,
    });
  }

  @Get('products/:productId/reviewable-orders')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'My delivered orders containing this product (eligible for rating)' })
  async reviewableOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    // Eligible = reached DELIVERED (or a post-delivery state) AND contains the product.
    // Order list rows carry only a summary, so confirm membership per order.
    const pages = await Promise.all(
      REVIEW_ELIGIBLE_STATUSES_ARR.map((status) =>
        this.gateway.order<{ items?: { id: string }[] }>(OrderPatterns.LIST_MY_ORDERS, {
          userId: user.userId,
          status,
          page: 1,
          limit: 50,
        }),
      ),
    );
    const candidates = pages.flatMap((page) => page?.items ?? []) as { id: string }[];
    const details = await Promise.all(
      candidates.map((order) =>
        this.gateway
          .order<{
            id: string;
            status: string;
            createdAt: string;
            items: { productId: string }[];
          }>(OrderPatterns.GET_ORDER, { orderId: order.id, userId: user.userId })
          .catch(() => null),
      ),
    );
    const items = (details.filter(Boolean) as NonNullable<(typeof details)[number]>[]).filter(
      (order) =>
        REVIEW_ELIGIBLE_STATUSES.has(order.status) &&
        (order.items ?? []).some((item) => item.productId === productId),
    );
    items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return { items };
  }

  @Public()
  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'Reviews for a product' })
  reviews(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: PaginationQueryDto,
    @Query('rating') rating?: string,
  ) {
    return this.gateway.catalog(CatalogPatterns.LIST_REVIEWS, {
      productId,
      page: query.page,
      limit: query.limit,
      rating: rating ? Number(rating) : undefined,
    });
  }

  @Post('reviews')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Write or update a review (only after the order is delivered)' })
  async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
    @Ctx() ctx: RequestContext,
  ) {
    // Delivery gate: the order must belong to the caller, contain this product,
    // and have reached DELIVERED (or a post-delivery state). The service stamps
    // the verified badge only from this check, never from a client claim.
    const order = await this.gateway.order<{
      id: string;
      userId: string;
      status: string;
      items: { productId: string }[];
    }>(OrderPatterns.GET_ORDER, { orderId: dto.orderId, userId: user.userId });

    if (!order || order.userId !== user.userId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    const hasProduct = (order.items ?? []).some((item) => item.productId === dto.productId);
    if (!hasProduct) {
      throw new BadRequestException('This product is not part of the given order');
    }
    if (!REVIEW_ELIGIBLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `You can rate this product only after the order is delivered (current status: ${order.status})`,
      );
    }

    return this.gateway.catalog(CatalogPatterns.CREATE_REVIEW, {
      user: { id: user.userId, name: this.displayName(user) },
      dto,
      ctx,
      verified: { orderId: order.id, isVerifiedPurchase: true },
    });
  }

  /** Reviews show a name, never a phone number. */
  private displayName(user: AuthenticatedUser): string {
    if (user.email) return user.email.split('@')[0];
    return `Customer ${user.mobile.slice(-4)}`;
  }
}

/**
 * A buyer may rate only once the order reached the customer's hands. Post-delivery
 * states (return requested / approved / returned / refunded) all imply the item was
 * delivered first, so they stay eligible; anything before DELIVERED is not.
 */
const REVIEW_ELIGIBLE_STATUSES = new Set<string>([
  OrderStatus.DELIVERED,
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURN_APPROVED,
  OrderStatus.RETURNED,
  OrderStatus.REFUNDED,
]);

const REVIEW_ELIGIBLE_STATUSES_ARR = [...REVIEW_ELIGIBLE_STATUSES] as OrderStatus[];
