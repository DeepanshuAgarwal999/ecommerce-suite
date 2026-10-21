import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types/pagination';
import type {
  AdminProductListItem,
  CreateProductInput,
  ProductDetail,
  ProductListQuery,
  ProductStatus,
  ReviewProductInput,
  UpdateProductInput,
} from '../types';

export interface PendingReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  orderId: string | null;
  isVerifiedPurchase: boolean;
  rating: number;
  title: string | null;
  comment: string | null;
  imageUrls: string[];
  createdAt: string;
}

export const productsApi = {
  list: (query: ProductListQuery) =>
    api.get<Paginated<AdminProductListItem>>(endpoints.admin.products, { searchParams: { ...query } }),

  get: (productId: string) => api.get<ProductDetail>(endpoints.admin.product(productId)),

  /** Admin creates on a chosen vendor's behalf — POST /admin/products takes vendorId
   *  in the body; the gateway resolves and validates the vendor itself. */
  create: (input: CreateProductInput) => api.post<ProductDetail>(endpoints.admin.products, input),

  /** Full edit, bypassing vendor ownership (ProductService.update's vendorId: null path). */
  update: (productId: string, input: UpdateProductInput) =>
    api.patch<ProductDetail>(endpoints.admin.product(productId), input),

  archive: (productId: string) => api.delete<{ ok: boolean }>(endpoints.admin.product(productId)),

  review: (productId: string, input: ReviewProductInput) =>
    api.post<ProductDetail>(endpoints.admin.productReview(productId), input),

  count: (status?: ProductListQuery['status']) =>
    api
      .get<Paginated<AdminProductListItem>>(endpoints.admin.products, {
        searchParams: { status, limit: 1 },
      })
      .then((result) => result.meta.total),

  /** Every status's count in one request — what the dashboard actually wants,
   *  instead of calling `count()` once per status. */
  summary: () =>
    api.get<{ status: ProductStatus; count: number }[]>(endpoints.admin.productsSummary),

  /** Pending product reviews awaiting moderation (unpublished). */
  pendingReviews: (query?: { page?: number; limit?: number; productId?: string }) =>
    api.get<Paginated<PendingReview>>(endpoints.admin.pendingReviews, {
      searchParams: { ...query },
    }),

  /** Approve = publish + fold stars into the product average. */
  approveReview: (reviewId: string) =>
    api.post<{ id: string; isPublished: boolean }>(endpoints.admin.reviewApprove(reviewId), {}),

  /** Reject = unpublish + remove stars from the product average. */
  rejectReview: (reviewId: string) =>
    api.post<{ id: string; isPublished: boolean }>(endpoints.admin.reviewReject(reviewId), {}),
};
