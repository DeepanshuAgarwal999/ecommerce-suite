import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CatalogPatterns, ProductStatus, RequestContext } from '@ecommerce/contracts';
import { BrandService } from './brand/brand.service';
import { CategoryService } from './category/category.service';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateReviewDto,
  ReviewProductDto,
  SearchProductsDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from '@ecommerce/contracts';
import { ProductService } from './product/product.service';
import { ReviewService } from './review/review.service';

@Controller()
export class CatalogController {
  constructor(
    private readonly categories: CategoryService,
    private readonly brands: BrandService,
    private readonly products: ProductService,
    private readonly reviews: ReviewService,
  ) {}

  // --- categories ----------------------------------------------------------

  @MessagePattern(CatalogPatterns.CATEGORY_TREE)
  categoryTree() {
    return this.categories.getTree();
  }

  @MessagePattern(CatalogPatterns.LIST_CATEGORIES)
  listCategories(@Payload() msg: { parentId?: string }) {
    return this.categories.list(msg.parentId);
  }

  @MessagePattern(CatalogPatterns.GET_CATEGORY)
  getCategory(@Payload() msg: { slug: string }) {
    return this.categories.getBySlug(msg.slug);
  }

  @MessagePattern(CatalogPatterns.CREATE_CATEGORY)
  createCategory(@Payload() msg: { dto: CreateCategoryDto }) {
    return this.categories.create(msg.dto);
  }

  @MessagePattern(CatalogPatterns.UPDATE_CATEGORY)
  updateCategory(@Payload() msg: { categoryId: string; dto: UpdateCategoryDto }) {
    return this.categories.update(msg.categoryId, msg.dto);
  }

  // --- brands --------------------------------------------------------------

  @MessagePattern(CatalogPatterns.LIST_BRANDS)
  listBrands(@Payload() msg: { q?: string }) {
    return this.brands.list(msg);
  }

  @MessagePattern(CatalogPatterns.CREATE_BRAND)
  createBrand(@Payload() msg: { dto: CreateBrandDto }) {
    return this.brands.create(msg.dto);
  }

  // --- products ------------------------------------------------------------

  @MessagePattern(CatalogPatterns.PRODUCT_CARDS)
  productCards(@Payload() msg: { productIds: string[] }) {
    return this.products.cards(msg.productIds ?? []);
  }

  @MessagePattern(CatalogPatterns.CATEGORY_CARDS)
  categoryCards(@Payload() msg: { categoryIds: string[] }) {
    return this.products.categoryCards(msg.categoryIds ?? []);
  }

  @MessagePattern(CatalogPatterns.FIND_BY_EXTERNAL_IDS)
  findByExternalIds(@Payload() msg: { source: string; externalIds: string[] }) {
    return this.products.findByExternalIds(msg.source, msg.externalIds ?? []);
  }

  @MessagePattern(CatalogPatterns.PRODUCT_INDEX)
  productIndex(@Payload() msg: { page: number; limit: number }) {
    return this.products.index(msg.page, msg.limit);
  }

  @MessagePattern(CatalogPatterns.SEARCH_SUGGEST)
  suggest(@Payload() msg: { q: string }) {
    return this.products.suggest(msg.q ?? '');
  }

  @MessagePattern(CatalogPatterns.SEARCH_PRODUCTS)
  search(@Payload() msg: SearchProductsDto) {
    return this.products.search(msg);
  }

  @MessagePattern(CatalogPatterns.GET_PRODUCT)
  getProduct(@Payload() msg: { productId: string; includeUnpublished?: boolean }) {
    return this.products.getById(msg.productId, {
      includeUnpublished: msg.includeUnpublished,
    });
  }

  @MessagePattern(CatalogPatterns.RESOLVE_VARIANTS)
  resolveVariants(@Payload() msg: { variantIds: string[]; productIds?: string[] }) {
    return this.products.resolveVariants(msg.variantIds ?? [], msg.productIds ?? []);
  }

  @MessagePattern(CatalogPatterns.ADMIN_SEARCH_PRODUCTS)
  adminSearch(
    @Payload()
    msg: {
      page?: number;
      limit?: number;
      q?: string;
      status?: ProductStatus | 'ALL';
      vendorId?: string;
      categoryId?: string;
      sort?: string;
    },
  ) {
    return this.products.adminSearch(msg);
  }

  @MessagePattern(CatalogPatterns.ADMIN_PRODUCTS_SUMMARY)
  adminProductsSummary() {
    return this.products.adminSummary();
  }

  @MessagePattern(CatalogPatterns.CREATE_PRODUCT)
  createProduct(
    @Payload()
    msg: {
      vendor: { id: string; name: string; code: string };
      dto: CreateProductDto;
      ctx: RequestContext;
    },
  ) {
    return this.products.create(msg.vendor, msg.dto, msg.ctx);
  }

  @MessagePattern(CatalogPatterns.UPDATE_PRODUCT)
  updateProduct(
    @Payload()
    msg: { productId: string; vendorId: string | null; dto: UpdateProductDto; ctx: RequestContext },
  ) {
    return this.products.update(msg.productId, msg.vendorId, msg.dto, msg.ctx);
  }

  @MessagePattern(CatalogPatterns.REVIEW_PRODUCT)
  reviewProduct(
    @Payload() msg: { productId: string; dto: ReviewProductDto; ctx: RequestContext },
  ) {
    return this.products.review(msg.productId, msg.dto, msg.ctx);
  }

  @MessagePattern(CatalogPatterns.ARCHIVE_PRODUCT)
  archiveProduct(
    @Payload() msg: { productId: string; vendorId: string | null; ctx: RequestContext },
  ) {
    return this.products.archive(msg.productId, msg.vendorId, msg.ctx);
  }

  @MessagePattern(CatalogPatterns.LIST_VENDOR_PRODUCTS)
  listVendorProducts(
    @Payload()
    msg: { vendorId: string; page?: number; limit?: number; status?: ProductStatus },
  ) {
    return this.products.listForVendor(msg.vendorId, msg);
  }

  // --- reviews -------------------------------------------------------------

  @MessagePattern(CatalogPatterns.CREATE_REVIEW)
  createReview(
    @Payload()
    msg: {
      user: { id: string; name: string };
      dto: CreateReviewDto;
      ctx: RequestContext;
      verified?: { orderId: string; isVerifiedPurchase: boolean };
    },
  ) {
    return this.reviews.create(msg.user, msg.dto, msg.ctx, {
      orderId: msg.verified?.orderId ?? msg.dto.orderId ?? '',
      isVerifiedPurchase: msg.verified?.isVerifiedPurchase === true,
    });
  }

  @MessagePattern(CatalogPatterns.LIST_REVIEWS)
  listReviews(
    @Payload() msg: { productId: string; page?: number; limit?: number; rating?: number },
  ) {
    return this.reviews.list(msg.productId, msg);
  }

  @MessagePattern(CatalogPatterns.LIST_PENDING_REVIEWS)
  listPendingReviews(
    @Payload() msg: { page?: number; limit?: number; productId?: string },
  ) {
    return this.reviews.listPending(msg ?? {});
  }

  @MessagePattern(CatalogPatterns.GET_MY_REVIEW)
  getMyReview(@Payload() msg: { productId: string; userId: string }) {
    return this.reviews.getMyReview(msg.productId, msg.userId);
  }

  @MessagePattern(CatalogPatterns.APPROVE_REVIEW)
  approveReview(
    @Payload() msg: { reviewId: string; user: { id: string; name: string } },
  ) {
    return this.reviews.approveReview(msg.user, msg.reviewId);
  }

  @MessagePattern(CatalogPatterns.REJECT_REVIEW)
  rejectReview(
    @Payload() msg: { reviewId: string; user: { id: string; name: string } },
  ) {
    return this.reviews.rejectReview(msg.user, msg.reviewId);
  }
}
