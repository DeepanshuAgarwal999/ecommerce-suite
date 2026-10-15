import type { PackSize, Product } from '@/features/catalog/types';

/** A cart row. Denormalised on purpose so the cart renders without refetching
 *  the catalog, and so a price change mid-session is visible on the next sync. */
export interface CartLine {
  productId: string;
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
  deliveryFeePaise: number;
  totalPaise: number;
}

export function toCartLine(product: Product, quantity: number): CartLine {
  return {
    productId: product.id,
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
