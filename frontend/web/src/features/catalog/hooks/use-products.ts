'use client';

import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { catalogApi } from '../api/catalog-api';
import type { ProductQuery } from '../types';

const PAGE_SIZE = 20;

/** Filtered listing that keeps the previous page visible while refetching, so
 *  changing a filter does not blank the grid. */
export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: queryKeys.catalog.products(query),
    queryFn: () => catalogApi.listProducts(query),
    placeholderData: keepPreviousData,
  });
}

/** Infinite scroll feed for category and search pages. */
export function useInfiniteProducts(query: Omit<ProductQuery, 'page'>) {
  return useInfiniteQuery({
    queryKey: queryKeys.catalog.products(query),
    queryFn: ({ pageParam }) =>
      catalogApi.listProducts({
        ...query,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.catalog.product(slug),
    queryFn: () => catalogApi.getProduct(slug),
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () => catalogApi.listCategories(),
    staleTime: 10 * 60_000,
  });
}
