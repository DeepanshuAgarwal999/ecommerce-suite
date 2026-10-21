import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import type { Category, Product, ProductQuery, RawProduct } from '../types';
import { toProduct } from '../types';

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

export interface ReviewBreakdown {
  rating: number;
  count: number;
}

export interface MyReview {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  imageUrls: string[];
  orderId: string | null;
  isVerifiedPurchase: boolean;
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

/**
 * Transport only. These are called from Server Components for the first paint
 * and from React Query hooks for anything interactive. Product responses go
 * through `toProduct` here so every caller gets the display shape - the raw
 * gateway shape (`media`, `title`, `minPrice`, ...) never leaks past this file.
 */
export const catalogApi = {
  listCategories: (init?: RequestInit) =>
    api.get<Category[]>(endpoints.catalog.categories, init),

  getCategory: (slug: string, init?: RequestInit) =>
    api.get<Category>(endpoints.catalog.category(slug), init),

  listProducts: async (query: ProductQuery, init?: RequestInit): Promise<Paginated<Product>> => {
    const page = await api.get<Paginated<RawProduct>>(endpoints.catalog.products, {
      ...init,
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

  getProduct: async (slug: string, init?: RequestInit): Promise<Product> => {
    const raw = await api.get<RawProduct>(endpoints.catalog.product(slug), init);
    return toProduct(raw);
  },

  listReviews: (productId: string, query?: { page?: number; limit?: number; rating?: number }) =>
    api.get<{ items: ReviewItem[]; meta: Paginated<unknown>['meta']; breakdown: ReviewBreakdown[] }>(
      endpoints.catalog.productReviews(productId),
      { searchParams: { ...query } },
    ),

  /** The signed-in buyer's own review for this product, if any (null when none/guest). */
  myReview: (productId: string) =>
    api.get<MyReview | null>(endpoints.catalog.myReview(productId)).catch(() => null),

  /** Delivered orders of the buyer that contain this product - the rating shortlist. */
  reviewableOrders: (productId: string) =>
    api.get<{ items: ReviewableOrder[] }>(endpoints.catalog.reviewableOrders(productId)),

  /** Write or update my review. Requires a delivered orderId the backend verifies. */
  createReview: (input: CreateReviewInput) => api.post<MyReview>(endpoints.catalog.reviews, input),
};

