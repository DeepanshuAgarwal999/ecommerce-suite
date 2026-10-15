'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trackRecommendation } from '@/features/analytics/track';
import { queryKeys } from '@/lib/api';
import { isApiError } from '@/lib/api/errors';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { wishlistApi } from '../api/wishlist-api';
import type { Paginated } from '@/types';
import type { WishlistItem } from '../types';

export function useWishlist() {
  const isSignedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.wishlist.list(),
    queryFn: () => wishlistApi.list(),
    enabled: isSignedIn,
  });
}

/** Reads off the shared wishlist query - no extra request per card. */
export function useIsWishlisted(productId: string, variantId?: string): boolean {
  const { data } = useWishlist();
  if (!data) return false;
  return data.items.some(
    (item) => item.productId === productId && (item.variantId ?? undefined) === variantId,
  );
}

interface ToggleInput {
  productId: string;
  variantId?: string;
  /** Only used to render the optimistic row - the server derives its own snapshot. */
  title: string;
  imageUrl?: string;
  priceAtSave: number;
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ToggleInput) =>
      wishlistApi.toggle({ productId: input.productId, variantId: input.variantId }),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.wishlist.list() });
      const previous = queryClient.getQueryData<Paginated<WishlistItem>>(queryKeys.wishlist.list());

      if (previous) {
        const matches = (item: WishlistItem) =>
          item.productId === input.productId && (item.variantId ?? undefined) === input.variantId;
        const alreadySaved = previous.items.some(matches);

        const items = alreadySaved
          ? previous.items.filter((item) => !matches(item))
          : [
              {
                id: `optimistic-${input.productId}-${input.variantId ?? 'default'}`,
                productId: input.productId,
                variantId: input.variantId ?? null,
                title: input.title,
                imageUrl: input.imageUrl ?? null,
                priceAtSave: input.priceAtSave,
                createdAt: new Date().toISOString(),
              },
              ...previous.items,
            ];

        queryClient.setQueryData(queryKeys.wishlist.list(), {
          ...previous,
          items,
          meta: { ...previous.meta, total: items.length },
        });
      }

      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.wishlist.list(), context.previous);
      toast.error(isApiError(error) ? error.message : 'Could not update your wishlist.');
    },

    onSuccess: (result, input) => {
      if (result.saved) trackRecommendation('wishlist', { productId: input.productId });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.list() }),
  });
}
