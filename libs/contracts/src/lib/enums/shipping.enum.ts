// See the note in role.enum.ts for why these are const objects rather than `enum`.

/**
 * How one item contributes to the delivery charge.
 *
 *  STANDARD - pays the store's order-level delivery fee, which is waived once the
 *             basket reaches the free-delivery threshold. Most products.
 *  FREE     - never causes a delivery charge (promotional or lightweight items).
 *  FIXED    - carries its own delivery charge (bulky items, furniture), outside the
 *             order-level fee and threshold; optionally waived above a line value.
 */
export const ShippingMode = {
  STANDARD: 'STANDARD',
  FREE: 'FREE',
  FIXED: 'FIXED',
} as const;

export type ShippingMode = (typeof ShippingMode)[keyof typeof ShippingMode];

/** For FIXED rules: charge once per unit, or once per order line regardless of quantity. */
export const ShippingChargeBasis = {
  PER_UNIT: 'PER_UNIT',
  PER_LINE: 'PER_LINE',
} as const;

export type ShippingChargeBasis = (typeof ShippingChargeBasis)[keyof typeof ShippingChargeBasis];

/** What a rule is attached to. The most specific one wins: product, then category (nearest ancestor first). */
export const ShippingRuleScope = {
  CATEGORY: 'CATEGORY',
  PRODUCT: 'PRODUCT',
} as const;

export type ShippingRuleScope = (typeof ShippingRuleScope)[keyof typeof ShippingRuleScope];
