const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const COMPACT = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Money is carried across the wire in paise (integer) so it never hits float
 * rounding. Format at the edge, never store the formatted string.
 */
export function formatPrice(paise: number): string {
  return INR.format(paise / 100);
}

/** "12.4k" for review counts, order counts, follower counts. */
export function formatCompact(value: number): string {
  return COMPACT.format(value);
}

/** Whole-percent discount, floored — never advertise more than is real. */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

/** "2 kg", "500 ml" — the pack-size line under a product title. */
export function formatPackSize(value: number, unit: string): string {
  return `${value} ${unit}`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** Delivery promise copy: "8 mins", "Tomorrow, 9 AM - 1 PM". */
export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr` : `${Math.round(hours / 24)} days`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
