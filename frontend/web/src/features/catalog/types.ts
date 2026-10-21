export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  productCount: number;
  children?: Category[];
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface PackSize {
  value: number;
  /** kg, g, ml, l, piece, pack */
  unit: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  images: ProductImage[];
  /** Integer paise. See lib/utils/format. */
  pricePaise: number;
  /** Struck-through list price. Equal to pricePaise when not discounted. */
  mrpPaise: number;
  /** Optional variant line under the title: "King · Cotton", "Set of 2". */
  variantLabel?: string;
  packSize?: PackSize;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  /** Per-order cap the inventory service enforces; the stepper honours it. */
  maxPerOrder: number;
  /** The variant a shopper buys from this listing (default variant) - sent at checkout. */
  variantId?: string;
  categorySlug: string;
  tags: string[];
  /** Delivery promise for the active pincode, when known: "Tue, 16 Sep". */
  deliveryLabel?: string;
}

/** Shape the gateway actually returns for a product - identical for a search
 *  hit and a detail fetch, except detail adds `description`/`category`. Kept
 *  separate from `Product` (the display-ready shape components render) so a
 *  backend field rename is one adapter edit, not a hunt through every component. */
export interface RawProduct {
  id: string;
  title: string;
  slug: string;
  description?: string;
  minPrice: number;
  maxPrice: number;
  ratingAverage: number;
  ratingCount: number;
  vendorName: string;
  media: { url: string; altText?: string | null }[];
  variants: { id?: string; title?: string; price: number; mrp: number; isDefault?: boolean }[];
  category?: { slug: string } | null;
}

/** Transport → display mapping. No stock summary exists on this payload (that is
 *  inventory-service's job via the per-pincode availability endpoint), so inStock/
 *  maxPerOrder are optimistic placeholders until a product page wires that call up. */
export function toProduct(raw: RawProduct): Product {
  const variant = raw.variants.find((item) => item.isDefault) ?? raw.variants[0];

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.title,
    brand: raw.vendorName,
    description: raw.description ?? '',
    images: raw.media.map((media) => ({ url: media.url, alt: media.altText || raw.title })),
    variantId: variant?.id,
    pricePaise: variant?.price ?? raw.minPrice,
    mrpPaise: variant?.mrp ?? raw.maxPrice,
    variantLabel: raw.variants.length > 1 ? variant?.title : undefined,
    rating: raw.ratingAverage,
    ratingCount: raw.ratingCount,
    inStock: true,
    maxPerOrder: 10,
    categorySlug: raw.category?.slug ?? '',
    tags: [],
  };
}

export type ProductSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'newest'
  | 'popular';

export interface ProductQuery {
  /** Resolved category UUID — see catalogApi.getCategory to go from a URL slug to this. */
  categoryId?: string;
  search?: string;
  sort?: ProductSort;
  brandId?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  page?: number;
  pageSize?: number;
}
