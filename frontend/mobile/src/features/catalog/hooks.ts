import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { catalogApi } from './api';
import type { Product, ProductQuery } from './types';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: ({ signal }) => catalogApi.listCategories(signal),
    staleTime: 30 * 60_000,
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: queryKeys.catalog.category(slug),
    queryFn: ({ signal }) => catalogApi.getCategory(slug, signal),
    staleTime: 30 * 60_000,
    enabled: Boolean(slug),
  });
}

export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.products(query),
    queryFn: ({ signal }) => catalogApi.listProducts(query, signal),
    staleTime: 5 * 60_000,
    enabled,
    select: (page) => page.items,
  });
}

/** Infinite feed for category listings and search results. */
export function useProductFeed(query: Omit<ProductQuery, 'page'>, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.catalog.products(query), 'infinite'],
    queryFn: ({ pageParam, signal }) => catalogApi.listProducts({ ...query, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/**
 * Product detail. Seeds from any list the product was already in, so tapping a
 * card opens the detail screen fully painted instantly - the fetch only fills in
 * the description.
 */
export function useProduct(slug: string) {
  const client = useQueryClient();
  return useQuery<Product>({
    queryKey: queryKeys.catalog.product(slug),
    queryFn: ({ signal }) => catalogApi.getProduct(slug, signal),
    staleTime: 5 * 60_000,
    placeholderData: () => findCachedProduct(client, slug),
  });
}

function findCachedProduct(client: ReturnType<typeof useQueryClient>, slug: string): Product | undefined {
  for (const [, data] of client.getQueriesData<unknown>({ queryKey: queryKeys.catalog.all })) {
    const pages = extractProducts(data);
    const hit = pages.find((product) => product.slug === slug || product.id === slug);
    if (hit) return hit;
  }
  return undefined;
}

function extractProducts(data: unknown): Product[] {
  if (!data || typeof data !== 'object') return [];
  if ('items' in data && Array.isArray((data as { items: unknown }).items)) {
    return (data as { items: Product[] }).items;
  }
  if ('pages' in data && Array.isArray((data as { pages: unknown }).pages)) {
    return (data as { pages: { items: Product[] }[] }).pages.flatMap((page) => page.items);
  }
  return [];
}
