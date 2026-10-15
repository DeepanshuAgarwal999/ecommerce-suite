import {
  DELIVERY_FEE_PAISE,
  FREE_DELIVERY_THRESHOLD_PAISE,
  amountToFreeDelivery,
  computeCartTotals,
} from '../src/features/cart/totals';
import type { CartLine } from '../src/features/cart/types';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'p1',
    slug: 'p1',
    name: 'Cushion cover',
    imageUrl: '',
    pricePaise: 49_900,
    mrpPaise: 79_900,
    quantity: 1,
    maxPerOrder: 10,
    ...overrides,
  };
}

describe('computeCartTotals', () => {
  it('returns zeros and no delivery fee for an empty cart', () => {
    expect(computeCartTotals([])).toEqual({
      itemCount: 0,
      subtotalPaise: 0,
      savingsPaise: 0,
      deliveryFeePaise: 0,
      totalPaise: 0,
    });
  });

  it('charges delivery below the free-delivery threshold', () => {
    const totals = computeCartTotals([line()]);
    expect(totals.subtotalPaise).toBe(49_900);
    expect(totals.savingsPaise).toBe(30_000);
    expect(totals.deliveryFeePaise).toBe(DELIVERY_FEE_PAISE);
    expect(totals.totalPaise).toBe(49_900 + DELIVERY_FEE_PAISE);
  });

  it('waives delivery at or above the threshold and multiplies by quantity', () => {
    const totals = computeCartTotals([
      line({ quantity: 2 }),
      line({ productId: 'p2', pricePaise: 120_000, mrpPaise: 120_000 }),
    ]);
    expect(totals.itemCount).toBe(3);
    expect(totals.subtotalPaise).toBe(49_900 * 2 + 120_000);
    expect(totals.deliveryFeePaise).toBe(0);
    expect(totals.totalPaise).toBe(totals.subtotalPaise);
  });
});

describe('amountToFreeDelivery', () => {
  it('reports the gap and clamps at zero', () => {
    expect(amountToFreeDelivery(0)).toBe(FREE_DELIVERY_THRESHOLD_PAISE);
    expect(amountToFreeDelivery(FREE_DELIVERY_THRESHOLD_PAISE - 100)).toBe(100);
    expect(amountToFreeDelivery(FREE_DELIVERY_THRESHOLD_PAISE + 1)).toBe(0);
  });
});
