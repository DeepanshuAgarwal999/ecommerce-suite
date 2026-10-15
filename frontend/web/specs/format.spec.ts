import { discountPercent, formatPrice, slugify } from '../src/lib/utils/format';

describe('formatPrice', () => {
  it('formats paise as whole rupees with Indian grouping', () => {
    expect(formatPrice(119_900)).toBe('₹1,199');
    expect(formatPrice(12_345_600)).toBe('₹1,23,456');
  });
});

describe('discountPercent', () => {
  it('floors and never overstates', () => {
    expect(discountPercent(199_900, 119_900)).toBe(40);
    expect(discountPercent(100_000, 66_700)).toBe(33);
  });

  it('is zero when there is no discount or MRP is invalid', () => {
    expect(discountPercent(100_000, 100_000)).toBe(0);
    expect(discountPercent(0, 100)).toBe(0);
    expect(discountPercent(100, 200)).toBe(0);
  });
});

describe('slugify', () => {
  it('produces url-safe kebab case', () => {
    expect(slugify('Rugs & Carpets')).toBe('rugs-carpets');
    expect(slugify('  Wall Décor 2024 ')).toBe('wall-d-cor-2024');
  });
});
