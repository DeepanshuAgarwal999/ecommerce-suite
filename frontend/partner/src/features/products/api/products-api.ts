import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import type { Brand, Category } from '../types';
import type { CreateProductInput, ProductStatus, UpdateProductInput, VendorProduct } from '../types';

export interface VendorProductsQuery {
  page?: number;
  limit?: number;
  status?: ProductStatus;
}

/** Mirrors apps/api-gateway vendor.controller's product routes. */
export const productsApi = {
  list: (query: VendorProductsQuery) =>
    api.get<Paginated<VendorProduct>>(endpoints.vendor.products, { searchParams: { ...query } }),

  create: (input: CreateProductInput) =>
    api.post<VendorProduct>(endpoints.vendor.products, input),

  update: (id: string, input: UpdateProductInput) =>
    api.patch<VendorProduct>(endpoints.vendor.product(id), input),

  archive: (id: string) => api.delete<{ ok: boolean }>(endpoints.vendor.product(id)),

  categories: () => api.get<Category[]>(endpoints.catalog.categories),
  brands: () => api.get<Brand[]>(endpoints.catalog.brands),
};
