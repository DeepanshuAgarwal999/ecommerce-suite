import { CURRENCY_MINOR_UNIT_FACTOR } from '@ecommerce/contracts';

/**
 * All money in this codebase is an integer count of the smallest currency unit (paise).
 *
 * Floating point cannot represent 0.1 exactly, so `19.99 * 3` is not `59.97`, and those
 * fractions of a paisa accumulate into ledgers that do not balance. Integers sidestep
 * the entire class of bug, and Razorpay expects paise anyway.
 */

export const toPaise = (rupees: number): number =>
  Math.round(rupees * CURRENCY_MINOR_UNIT_FACTOR);

export const toRupees = (paise: number): number => paise / CURRENCY_MINOR_UNIT_FACTOR;

export const formatINR = (paise: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(toRupees(paise));

/** Basis points avoid a second rounding step: 1800 bps = 18%. */
export const applyBps = (amountPaise: number, bps: number): number =>
  Math.round((amountPaise * bps) / 10_000);

export const percentOf = (amountPaise: number, percent: number): number =>
  Math.round((amountPaise * percent) / 100);

/**
 * Splits an amount across lines proportionally, giving any remainder to the largest
 * line. Used to distribute an order-level coupon over items so per-item refunds and
 * per-vendor settlements still add up to the amount actually charged.
 */
export function distributeProportionally(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0 || total === 0) return weights.map(() => 0);

  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum));
  const distributed = shares.reduce((sum, share) => sum + share, 0);
  let remainder = total - distributed;

  // Hand out leftover paise starting from the heaviest line.
  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    shares[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return shares;
}

export interface PricingBreakdown {
  itemTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  codFee: number;
  grandTotal: number;
}

/** Single place where an order total is computed, so cart, checkout and order agree. */
export function computeTotals(input: {
  itemTotal: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxBps?: number;
  codFee?: number;
}): PricingBreakdown {
  const itemTotal = Math.max(0, Math.round(input.itemTotal));
  const discountTotal = Math.min(itemTotal, Math.max(0, Math.round(input.discountTotal ?? 0)));
  const shippingTotal = Math.max(0, Math.round(input.shippingTotal ?? 0));
  const codFee = Math.max(0, Math.round(input.codFee ?? 0));

  // Tax applies to the discounted value, not the list price.
  const taxable = itemTotal - discountTotal;
  const taxTotal = applyBps(taxable, input.taxBps ?? 0);

  return {
    itemTotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    codFee,
    grandTotal: taxable + shippingTotal + taxTotal + codFee,
  };
}
