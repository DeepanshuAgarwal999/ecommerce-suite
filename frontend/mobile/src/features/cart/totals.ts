import type { CartLine, CartTotals } from './types';

/**
 * Item maths only. Delivery is not computed on the device: it comes from the
 * server's admin-managed rules (see features/shipping useDeliveryEstimate and
 * useCartTotals), so the cart can never show a fee checkout won't charge.
 */
export function computeItemTotals(lines: CartLine[]): Pick<CartTotals, 'itemCount' | 'subtotalPaise' | 'savingsPaise'> {
  let itemCount = 0;
  let subtotalPaise = 0;
  let mrpTotalPaise = 0;

  for (const line of lines) {
    itemCount += line.quantity;
    subtotalPaise += line.pricePaise * line.quantity;
    mrpTotalPaise += line.mrpPaise * line.quantity;
  }

  return { itemCount, subtotalPaise, savingsPaise: mrpTotalPaise - subtotalPaise };
}
