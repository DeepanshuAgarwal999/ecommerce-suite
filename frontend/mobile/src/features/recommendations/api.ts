import { useQuery } from '@tanstack/react-query';
import { api, endpoints, queryKeys } from '@/lib/api';
import { toProduct, type Product, type RawProduct } from '@/features/catalog/types';

/** How a list was produced - drives the heading ("Frequently bought together" vs "Goes well with"). */
export type RecSource = 'learned' | 'category' | 'trending' | 'personal' | 'none';

interface RawList {
  source?: RecSource;
  items: RawProduct[];
}

export interface RecList {
  source: RecSource;
  items: Product[];
}

export interface CategoryChip {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

const toList = (list: RawList | undefined): RecList => ({
  source: list?.source ?? 'none',
  items: (list?.items ?? []).map(toProduct),
});

/**
 * Personalised reads keyed by the install id (X-Visitor-Id) and the session.
 * The gateway already degrades to empty lists if the recommender is down.
 */
export const recsApi = {
  product: async (productId: string) => {
    const raw = await api.get<{ boughtTogether: RawList; alsoViewed: RawList; similar: RawList }>(
      endpoints.recommendations.product(productId),
    );
    return {
      boughtTogether: toList(raw.boughtTogether),
      alsoViewed: toList(raw.alsoViewed),
      similar: toList(raw.similar),
    };
  },

  cart: async (productIds: string[]) =>
    toList(await api.get<RawList>(endpoints.recommendations.cart, { searchParams: { productIds: productIds.join(',') } })),

  forYou: async () => {
    const raw = await api.get<{
      recentlyViewed: RawList;
      categories: { items: CategoryChip[] };
      recommended: RawList;
    }>(endpoints.recommendations.forYou);
    return {
      recentlyViewed: toList(raw.recentlyViewed),
      categories: raw.categories.items,
      recommended: toList(raw.recommended),
    };
  },
};

export function useForYou(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recommendations.forYou(),
    queryFn: recsApi.forYou,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useProductRecommendations(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recommendations.product(productId ?? ''),
    queryFn: () => recsApi.product(productId!),
    staleTime: 10 * 60_000,
    enabled: Boolean(productId),
  });
}

export function useCartRecommendations(productIds: string[]) {
  return useQuery({
    queryKey: queryKeys.recommendations.cart(productIds),
    queryFn: () => recsApi.cart(productIds),
    staleTime: 5 * 60_000,
    enabled: productIds.length > 0,
  });
}
