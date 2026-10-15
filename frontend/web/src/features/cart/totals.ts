import type { CartLine, CartTotals } from './types';

/** Orders below this subtotal pay the delivery fee. Must match the USP copy in config/nav. */
export const FREE_DELIVERY_THRESHOLD_PAISE = 99_900;
export const DELIVERY_FEE_PAISE = 4_900;

export function computeCartTotals(lines: CartLine[]): CartTotals {
  let itemCount = 0;
  let subtotalPaise = 0;
  let mrpTotalPaise = 0;

  for (const line of lines) {
    itemCount += line.quantity;
    subtotalPaise += line.pricePaise * line.quantity;
    mrpTotalPaise += line.mrpPaise * line.quantity;
  }

  const deliveryFeePaise =
    subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE
      ? 0
      : DELIVERY_FEE_PAISE;

  return {
    itemCount,
    subtotalPaise,
    savingsPaise: mrpTotalPaise - subtotalPaise,
    deliveryFeePaise,
    totalPaise: subtotalPaise + deliveryFeePaise,
  };
}

/** Paise still needed to unlock free delivery, or 0 when already there. */
export function amountToFreeDelivery(subtotalPaise: number): number {
  return Math.max(0, FREE_DELIVERY_THRESHOLD_PAISE - subtotalPaise);
}
