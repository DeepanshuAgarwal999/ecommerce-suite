import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import { toProduct, type Category, type Product, type ProductQuery, type RawProduct } from './types';

export interface ReviewItem {
  id: string;
  userName: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  imageUrls: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface MyReview {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  imageUrls: string[];
  orderId: string | null;
  isVerifiedPurchase: boolean;
  /** New reviews and edits stay hidden until staff approve them. */
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewableOrder {
  id: string;
  status: string;
  createdAt: string;
}

export interface CreateReviewInput {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  comment?: string;
  imageUrls?: string[];
}

export interface ReviewBreakdown {
  rating: number;
  count: number;
}

/**
 * Transport only - mirrors frontend/web features/catalog/api. Product responses
 * go through `toProduct` here so the raw gateway shape never leaks past this file.
 */
export const catalogApi = {
  listCategories: (signal?: AbortSignal) => api.get<Category[]>(endpoints.catalog.categories, { signal }),

  getCategory: (slug: string, signal?: AbortSignal) =>
    api.get<Category>(endpoints.catalog.category(slug), { signal }),

  listProducts: async (query: ProductQuery, signal?: AbortSignal): Promise<Paginated<Product>> => {
    const page = await api.get<Paginated<RawProduct>>(endpoints.catalog.products, {
      signal,
      searchParams: {
        categoryId: query.categoryId,
        q: query.search,
        sort: query.sort,
        brandId: query.brandId,
        minPrice: query.minPricePaise,
        maxPrice: query.maxPricePaise,
        page: query.page,
        limit: query.pageSize,
      },
    });
    return { items: page.items.map(toProduct), meta: page.meta };
  },

  getProduct: async (slug: string, signal?: AbortSignal): Promise<Product> =>
    toProduct(await api.get<RawProduct>(endpoints.catalog.product(slug), { signal })),

  listReviews: (productId: string, query?: { page?: number; limit?: number; rating?: number }) =>
    api.get<{ items: ReviewItem[]; meta: Paginated<unknown>['meta']; breakdown: ReviewBreakdown[] }>(
      endpoints.catalog.productReviews(productId),
      { searchParams: { ...query } },
    ),

  /** The signed-in buyer's own review, or null (none yet / signed out). */
  myReview: (productId: string) => api.get<MyReview | null>(endpoints.catalog.myReview(productId)).catch(() => null),

  /** Delivered orders containing this product - the review is verified against one of these. */
  reviewableOrders: (productId: string) => api.get<{ items: ReviewableOrder[] }>(endpoints.catalog.reviewableOrders(productId)),

  /** Create or update my review (upsert per product). Requires a delivered orderId. */
  createReview: (input: CreateReviewInput) => api.post<MyReview>(endpoints.catalog.reviews, input),
};
