import type { PackSize, Product } from '@/features/catalog/types';

/** A cart row. Denormalised on purpose so the cart renders without refetching
 *  the catalog, and so a price change mid-session is visible on the next sync. */
export interface CartLine {
  productId: string;
  /** Older persisted lines may lack it - the server then uses the default variant. */
  variantId?: string;
  slug: string;
  name: string;
  imageUrl: string;
  pricePaise: number;
  mrpPaise: number;
  variantLabel?: string;
  packSize?: PackSize;
  quantity: number;
  maxPerOrder: number;
}

export interface CartTotals {
  itemCount: number;
  subtotalPaise: number;
  /** MRP minus price, summed — the "you saved" line. */
  savingsPaise: number;
  /** From the server estimate; 0 until it arrives (see deliveryKnown). */
  deliveryFeePaise: number;
  totalPaise: number;
  /** False while the delivery estimate is loading or unavailable - show "at checkout". */
  deliveryKnown: boolean;
  /** Paise left for free delivery, or null when free delivery isn't on offer for this basket. */
  freeDeliveryRemaining: number | null;
  /** The store threshold, for progress bars; null = none. */
  freeDeliveryThreshold: number | null;
}

export function toCartLine(product: Product, quantity: number): CartLine {
  return {
    productId: product.id,
    variantId: product.variantId,
    slug: product.slug,
    name: product.name,
    imageUrl: product.images[0]?.url ?? '',
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    variantLabel: product.variantLabel,
    packSize: product.packSize,
    quantity,
    maxPerOrder: product.maxPerOrder,
  };
}
