import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, Public } from '@ecommerce/auth';
import { Ctx, PaginationQueryDto } from '@ecommerce/common';
import {
  AuthenticatedUser,
  CatalogPatterns,
  CreateReviewDto,
  InventoryPatterns,
  MerchandisingPatterns,
  RecommendationPatterns,
  RequestContext,
  SearchProductsDto,
  SearchSuggestDto,
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
  @ApiOperation({ summary: 'Write or update a review' })
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.catalog(CatalogPatterns.CREATE_REVIEW, {
      user: { id: user.userId, name: this.displayName(user) },
      dto,
      ctx,
    });
  }

  /** Reviews show a name, never a phone number. */
  private displayName(user: AuthenticatedUser): string {
    if (user.email) return user.email.split('@')[0];
    return `Customer ${user.mobile.slice(-4)}`;
  }
}
