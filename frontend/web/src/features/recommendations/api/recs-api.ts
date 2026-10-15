import { api, endpoints } from '@/lib/api';
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
 * Personalised reads - always called from the browser (they depend on the visitor
 * id and session), never during SSR, so cached pages stay shared. The gateway
 * already degrades to empty lists if the recommender is down.
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
