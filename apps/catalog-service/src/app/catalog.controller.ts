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
  resolveVariants(@Payload() msg: { variantIds: string[] }) {
    return this.products.resolveVariants(msg.variantIds);
  }

  @MessagePattern(CatalogPatterns.ADMIN_SEARCH_PRODUCTS)
  adminSearch(
    @Payload()
    msg: {
      page?: number;
      limit?: number;
      q?: string;
      status?: ProductStatus;
      vendorId?: string;
      categoryId?: string;
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
    @Payload() msg: { user: { id: string; name: string }; dto: CreateReviewDto; ctx: RequestContext },
  ) {
    return this.reviews.create(msg.user, msg.dto, msg.ctx);
  }

  @MessagePattern(CatalogPatterns.LIST_REVIEWS)
  listReviews(
    @Payload() msg: { productId: string; page?: number; limit?: number; rating?: number },
  ) {
    return this.reviews.list(msg.productId, msg);
  }
}
