import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import type { Category, Product, ProductQuery, RawProduct } from '../types';
import { toProduct } from '../types';

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
};
