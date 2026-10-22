import type { EffectiveShippingRule, ShippingContext } from '@ecommerce/contracts';

export interface ShippingLine {
  productId: string;
  quantity: number;
  /** Line total in paise, before any order-level coupon. */
  lineTotal: number;
}

export interface ShippingResult {
  /** What the order is charged for delivery, in paise. */
  shippingTotal: number;
  /** Order-level fee charged for STANDARD items (0 when waived or when there are none). */
  baseFee: number;
  /** Per-line FIXED charges (only lines that actually pay). */
  itemCharges: { productId: string; fee: number }[];
  /**
   * Paise still needed for free delivery on STANDARD items, or null when the
   * threshold is off or there are no STANDARD items to make free.
   */
  freeShippingRemaining: number | null;
  /** Value counted towards the threshold (STANDARD + FREE items, after their share of the discount). */
  thresholdBasket: number;
}

const DEFAULT_RULE: EffectiveShippingRule = {
  mode: 'STANDARD',
  fee: 0,
  chargeBasis: 'PER_UNIT',
  freeAbove: null,
  source: 'DEFAULT',
  sourceId: null,
  sourceName: null,
};

/**
 * The one delivery-charge calculator. cart-service runs it for every cart view,
 * quote and order snapshot; catalog-service runs it for the public basket
 * estimate - so the number a shopper sees and the number they pay can't drift.
 *
 *   STANDARD lines -> one order-level `baseFee`, waived when the threshold basket
 *                     (STANDARD + FREE lines, after their share of the coupon) reaches
 *                     `freeShippingThreshold`.
 *   FREE lines     -> no charge; they still count towards the threshold.
 *   FIXED lines    -> their own fee (per unit or per line), waived when the line total
 *                     reaches `freeAbove`; outside the threshold entirely.
 */
export function computeShipping(lines: ShippingLine[], discountTotal: number, context: ShippingContext): ShippingResult {
  const itemTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = Math.min(Math.max(0, discountTotal), itemTotal);

  let standardValue = 0;
  let freeValue = 0;
  const itemCharges: ShippingResult['itemCharges'] = [];

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const rule = context.rules[line.productId] ?? DEFAULT_RULE;

    if (rule.mode === 'FIXED') {
      const waived = rule.freeAbove !== null && line.lineTotal >= rule.freeAbove;
      const fee = waived ? 0 : rule.chargeBasis === 'PER_LINE' ? rule.fee : rule.fee * line.quantity;
      if (fee > 0) itemCharges.push({ productId: line.productId, fee });
    } else if (rule.mode === 'FREE') {
      freeValue += line.lineTotal;
    } else {
      standardValue += line.lineTotal;
    }
  }

  // The coupon is an order-level discount; spread it across lines by value so the
  // threshold is measured on what the shopper actually pays for those items.
  const thresholdGross = standardValue + freeValue;
  const discountShare = itemTotal > 0 ? Math.round((discount * thresholdGross) / itemTotal) : 0;
  const thresholdBasket = Math.max(0, thresholdGross - discountShare);

  const { baseFee: fee, freeShippingThreshold: threshold } = context.settings;
  let baseFee = 0;
  let freeShippingRemaining: number | null = null;

  if (standardValue > 0) {
    const waived = threshold !== null && thresholdBasket >= threshold;
    baseFee = waived ? 0 : fee;
    freeShippingRemaining = threshold === null ? null : Math.max(0, threshold - thresholdBasket);
  }

  const shippingTotal = baseFee + itemCharges.reduce((sum, charge) => sum + charge.fee, 0);
  return { shippingTotal, baseFee, itemCharges, freeShippingRemaining, thresholdBasket };
}
