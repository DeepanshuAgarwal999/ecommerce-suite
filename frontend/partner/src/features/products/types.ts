/** Mirrors ProductStatus in libs/contracts/enums/catalog.enum.ts. */
export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  price: number;
  mrp: number;
}

/** A row from GET /vendor/products. */
export interface VendorProduct {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string | null;
  updatedAt: string;
  variants: ProductVariant[];
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

/** Mirrors CreateProductDto. */
export interface CreateProductInput {
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
  submitForReview?: boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;
