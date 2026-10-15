import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import type { ToggleWishlistInput, ToggleWishlistResult, WishlistItem } from '../types';

export const wishlistApi = {
  /** A personal list - one page comfortably covers it, so this skips UI pagination. */
  list: () =>
    api.get<Paginated<WishlistItem>>(endpoints.wishlist.list, {
      searchParams: { limit: 100 },
    }),

  toggle: (input: ToggleWishlistInput) =>
    api.post<ToggleWishlistResult>(endpoints.wishlist.toggle, input),
};
