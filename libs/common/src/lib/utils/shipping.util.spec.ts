import type { EffectiveShippingRule, ShippingContext } from '@ecommerce/contracts';
import { computeShipping } from './shipping.util';

const settings = { baseFee: 4_900, freeShippingThreshold: 99_900, codEnabled: true, codFee: 2_900 };

function rule(partial: Partial<EffectiveShippingRule>): EffectiveShippingRule {
  return { mode: 'STANDARD', fee: 0, chargeBasis: 'PER_UNIT', freeAbove: null, source: 'CATEGORY', sourceId: 'c1', sourceName: 'Cat', ...partial };
}

function ctx(rules: Record<string, EffectiveShippingRule> = {}, overrides: Partial<ShippingContext['settings']> = {}): ShippingContext {
  return { settings: { ...settings, ...overrides }, rules };
}

describe('computeShipping', () => {
  it('charges the base fee below the threshold and waives it at the threshold', () => {
    expect(computeShipping([{ productId: 'a', quantity: 1, lineTotal: 50_000 }], 0, ctx()).shippingTotal).toBe(4_900);
    const free = computeShipping([{ productId: 'a', quantity: 2, lineTotal: 99_900 }], 0, ctx());
    expect(free.shippingTotal).toBe(0);
    expect(free.freeShippingRemaining).toBe(0);
  });

  it('measures the threshold after the coupon', () => {
    // 1,000 basket - 200 coupon = 800 < 999 -> fee applies.
    const result = computeShipping([{ productId: 'a', quantity: 1, lineTotal: 100_000 }], 20_000, ctx());
    expect(result.shippingTotal).toBe(4_900);
    expect(result.freeShippingRemaining).toBe(19_900);
  });

  it('never makes STANDARD items free when the threshold is switched off', () => {
    const result = computeShipping([{ productId: 'a', quantity: 1, lineTotal: 5_000_000 }], 0, ctx({}, { freeShippingThreshold: null }));
    expect(result.shippingTotal).toBe(4_900);
    expect(result.freeShippingRemaining).toBeNull();
  });

  it('charges nothing for a basket of only FREE items, and FREE items count towards the threshold', () => {
    const rules = { f: rule({ mode: 'FREE' }) };
    expect(computeShipping([{ productId: 'f', quantity: 1, lineTotal: 10_000 }], 0, ctx(rules)).shippingTotal).toBe(0);

    const mixed = computeShipping(
      [
        { productId: 'f', quantity: 1, lineTotal: 60_000 },
        { productId: 'a', quantity: 1, lineTotal: 40_000 },
      ],
      0,
      ctx(rules),
    );
    expect(mixed.shippingTotal).toBe(0); // 600 + 400 = 1,000 >= 999
  });

  it('adds FIXED charges per unit or per line, outside the threshold', () => {
    const rules = {
      sofa: rule({ mode: 'FIXED', fee: 49_900, chargeBasis: 'PER_UNIT' }),
      rug: rule({ mode: 'FIXED', fee: 19_900, chargeBasis: 'PER_LINE' }),
    };
    const result = computeShipping(
      [
        { productId: 'sofa', quantity: 2, lineTotal: 4_000_000 },
        { productId: 'rug', quantity: 3, lineTotal: 300_000 },
      ],
      0,
      ctx(rules),
    );
    expect(result.itemCharges).toEqual([
      { productId: 'sofa', fee: 99_800 },
      { productId: 'rug', fee: 19_900 },
    ]);
    // No STANDARD items, so no base fee - a sofa alone doesn't also pay ₹49.
    expect(result.baseFee).toBe(0);
    expect(result.shippingTotal).toBe(119_700);
    expect(result.freeShippingRemaining).toBeNull();
  });

  it('waives a FIXED charge once the line reaches freeAbove', () => {
    const rules = { lamp: rule({ mode: 'FIXED', fee: 9_900, freeAbove: 200_000 }) };
    expect(computeShipping([{ productId: 'lamp', quantity: 1, lineTotal: 150_000 }], 0, ctx(rules)).shippingTotal).toBe(9_900);
    expect(computeShipping([{ productId: 'lamp', quantity: 2, lineTotal: 200_000 }], 0, ctx(rules)).shippingTotal).toBe(0);
  });

  it('combines a base fee for STANDARD items with FIXED item charges', () => {
    const rules = { sofa: rule({ mode: 'FIXED', fee: 49_900 }) };
    const result = computeShipping(
      [
        { productId: 'sofa', quantity: 1, lineTotal: 2_000_000 },
        { productId: 'cushion', quantity: 1, lineTotal: 30_000 },
      ],
      0,
      ctx(rules),
    );
    // The sofa's value doesn't unlock free delivery for the cushion.
    expect(result.baseFee).toBe(4_900);
    expect(result.shippingTotal).toBe(54_800);
  });

  it('treats an empty basket as free', () => {
    expect(computeShipping([], 0, ctx()).shippingTotal).toBe(0);
  });
});
