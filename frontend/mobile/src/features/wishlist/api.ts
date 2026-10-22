import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trackRecommendation } from '@/features/analytics/track';
import { useIsSignedIn } from '@/features/auth/session';
import { api, endpoints, queryKeys } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import type { Paginated } from '@/types';
import type { ToggleWishlistInput, ToggleWishlistResult, WishlistItem } from './types';

export const wishlistApi = {
  list: () => api.get<Paginated<WishlistItem>>(endpoints.wishlist.list, { searchParams: { limit: 100 } }),
  toggle: (input: ToggleWishlistInput) => api.post<ToggleWishlistResult>(endpoints.wishlist.toggle, input),
};

export function useWishlist() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.wishlist.list(),
    queryFn: wishlistApi.list,
    enabled: signedIn,
    staleTime: 60_000,
    select: (page) => page.items,
  });
}

/** Saved product ids, for heart icons on cards. One Set shared by every card. */
export function useWishlistIds(): Set<string> {
  const { data } = useWishlist();
  return useStableIdSet(data);
}

let lastItems: WishlistItem[] | undefined;
let lastSet = new Set<string>();
function useStableIdSet(items: WishlistItem[] | undefined): Set<string> {
  if (items !== lastItems) {
    lastItems = items;
    lastSet = new Set(items?.map((item) => item.productId));
  }
  return lastSet;
}

/**
 * Optimistic heart toggle: the icon flips instantly, the request runs behind it,
 * and a failure rolls the list back.
 */
export function useToggleWishlist() {
  const client = useQueryClient();
  const key = queryKeys.wishlist.list();

  return useMutation({
    mutationFn: wishlistApi.toggle,
    onMutate: async (input) => {
      haptic.light();
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Paginated<WishlistItem>>(key);
      if (previous) {
        const exists = previous.items.some((item) => item.productId === input.productId);
        const items = exists
          ? previous.items.filter((item) => item.productId !== input.productId)
          : [
              {
                id: `optimistic-${input.productId}`,
                productId: input.productId,
                variantId: input.variantId ?? null,
                title: '',
                imageUrl: null,
                priceAtSave: 0,
                createdAt: new Date().toISOString(),
              },
              ...previous.items,
            ];
        client.setQueryData(key, { ...previous, items });
      }
      return { previous };
    },
    onSuccess: (result, input) => {
      if (result.saved) trackRecommendation('wishlist', { productId: input.productId });
    },
    onError: (_error, _input, context) => {
      haptic.error();
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
