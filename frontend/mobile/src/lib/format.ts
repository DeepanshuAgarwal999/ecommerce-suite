/**
 * Money crosses the wire as integer paise and is formatted only at the edge -
 * same contract as frontend/web lib/utils/format.
 *
 * Indian digit grouping (1,23,456) is done by hand rather than via
 * Intl.NumberFormat: prices render hundreds of times per scroll, and a plain
 * string function is both faster and identical across Hermes builds.
 */
function groupIndian(whole: number): string {
  const digits = Math.abs(Math.trunc(whole)).toString();
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function formatPrice(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `${rupees < 0 ? '-' : ''}₹${groupIndian(rupees)}`;
}

/** "12.4k" / "1.2L" style counts for ratings and orders. */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 100_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(value / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
}

/** Whole-percent discount, floored - never advertise more than is real. */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue, 16 Sep" */
export function formatShortDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "16 Sep 2026, 4:05 PM" */
export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}
