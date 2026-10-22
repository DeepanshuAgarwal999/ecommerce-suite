/** Mirrors WishlistItem in apps/cart-service/prisma/schema.prisma. No slug is stored —
 *  link via /p/{productId}, which the product route accepts as a fallback to the slug. */
export interface WishlistItem {
  id: string;
  productId: string;
  variantId: string | null;
  title: string;
  imageUrl: string | null;
  /** Integer paise, captured at save time so a "price dropped" badge needs no history table. */
  priceAtSave: number;
  createdAt: string;
}

export interface ToggleWishlistInput {
  productId: string;
  variantId?: string;
}

export interface ToggleWishlistResult {
  saved: boolean;
}
