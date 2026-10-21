export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';

/** Who created the listing — same ClientSource values and convention as Order.source. */
export type ProductSource = 'VENDOR_WEB' | 'ADMIN_WEB' | 'ANDROID' | 'IOS' | 'API';

/** Mirrors ProductService.adminSearch()'s select in apps/catalog-service. */
export interface AdminProductListItem {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  vendorId: string;
  vendorName: string;
  source: ProductSource;
  externalSource: string | null;
  externalProductId: string | null;
  categoryId: string;
  minPrice: number;
  maxPrice: number;
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: { url: string }[];
  variants: { id: string; sku: string }[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  mrp: number;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
}

/** Mirrors ProductService.getById()'s include. */
export interface ProductDetail {
  id: string;
  vendorId: string;
  vendorName: string;
  source: ProductSource;
  externalSource: string | null;
  externalProductId: string | null;
  title: string;
  slug: string;
  description: string | null;
  highlights: string[];
  status: ProductStatus;
  rejectionReason: string | null;
  categoryId: string;
  brandId: string | null;
  minPrice: number;
  maxPrice: number;
  taxBps: number;
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  isReturnable: boolean;
  returnWindowDays: number;
  isCodAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  variants: ProductVariant[];
  media: { id: string; url: string; altText: string | null; displayOrder: number }[];
  category: { id: string; name: string; slug: string; path: string };
  brand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

export interface Brand {
  id: string;
  name: string;
}

/** Vendor row used to populate the "attribute to" picker on the create form. */
export interface VendorOption {
  id: string;
  businessName: string;
  status: string;
}

/** Mirrors VariantInputDto. */
export interface VariantInput {
  title: string;
  options: Record<string, string>;
  mrp: number;
  price: number;
  sku?: string;
  weightGrams?: number;
  imageUrl?: string;
  isDefault?: boolean;
}

/** Mirrors CreateProductDto, plus the admin-only vendorId it rides on top of. */
export interface CreateProductInput {
  vendorId: string;
  title: string;
  description?: string;
  highlights?: string[];
  categoryId: string;
  brandId?: string;
  variants: VariantInput[];
  imageUrls?: string[];
  isReturnable?: boolean;
  returnWindowDays?: number;
  isCodAvailable?: boolean;
  deliveryPrice?: number;
  submitForReview?: boolean;
  externalSource?: string;
  externalProductId?: string;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'vendorId'>>;

export type ProductListSort = 'updated' | 'newest' | 'title' | 'price_asc' | 'price_desc' | 'best_selling' | 'rating';

export interface ProductListQuery {
  page?: number;
  limit?: number;
  q?: string;
  /** A status, or ALL to include drafts (omitted = everything except drafts). */
  status?: ProductStatus | 'ALL';
  vendorId?: string;
  categoryId?: string;
  sort?: ProductListSort;
}

export interface ReviewProductInput {
  status: 'ACTIVE' | 'REJECTED';
  reason?: string;
}
