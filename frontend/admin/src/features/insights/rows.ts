import { formatMoney, formatNumber } from '@/lib/format';
import type { RankedRow } from './components/ranked-list';
import type { Engagement, Sales, TermCount, Wishlist } from './types';

/** Shared by the Insights page and the dashboard highlights, so both read the same way. */

export function searchRows(terms: TermCount[]): RankedRow[] {
  return terms.map((term) => ({
    key: term.term,
    label: term.term,
    value: term.count,
    valueLabel: formatNumber(term.count),
  }));
}

export function viewedRows(products: Engagement['topViewed']): RankedRow[] {
  return products.map((product) => ({
    key: product.productId,
    label: product.title,
    href: `/products/${product.productId}`,
    imageUrl: product.imageUrl,
    value: product.views,
    valueLabel: `${formatNumber(product.views)} views`,
    meta:
      product.orders === null
        ? undefined
        : `${formatNumber(product.orders)} orders · ${(product.conversion ?? 0).toFixed(1)}%`,
  }));
}

export function soldRows(products: Sales['top']): RankedRow[] {
  return products.map((product) => ({
    key: product.productId,
    label: product.title,
    href: `/products/${product.productId}`,
    imageUrl: product.imageUrl,
    value: product.units,
    valueLabel: `${formatNumber(product.units)} sold`,
    meta: `${formatNumber(product.orders)} orders · ${formatMoney(product.revenue)}`,
  }));
}

export function wishlistedRows(products: Wishlist['top'], days: number): RankedRow[] {
  return products.map((product) => ({
    key: product.productId,
    label: product.title,
    href: `/products/${product.productId}`,
    imageUrl: product.imageUrl,
    value: product.saves,
    valueLabel: `${formatNumber(product.saves)} saves`,
    meta: product.recent > 0 ? `+${formatNumber(product.recent)} in ${days}d` : undefined,
  }));
}
