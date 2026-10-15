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
};
