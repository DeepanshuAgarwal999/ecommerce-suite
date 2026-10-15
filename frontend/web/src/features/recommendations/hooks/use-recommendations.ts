'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { recsApi } from '../api/recs-api';

/** Recommendations are decoration: a failure just means the rails don't render. */
const quiet = { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } as const;

export function useProductRecommendations(productId: string) {
  return useQuery({ queryKey: queryKeys.recommendations.product(productId), queryFn: () => recsApi.product(productId), ...quiet });
}

export function useCartRecommendations(productIds: string[]) {
  const ids = [...productIds].sort();
  return useQuery({
    queryKey: queryKeys.recommendations.cart(ids),
    queryFn: () => recsApi.cart(ids),
    enabled: ids.length > 0,
    ...quiet,
  });
}

export function useForYou() {
  return useQuery({ queryKey: queryKeys.recommendations.forYou(), queryFn: recsApi.forYou, ...quiet });
}
