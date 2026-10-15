/** Mirrors GET /admin/insights (api-gateway InsightsAdminController). */
export type InsightRange = 1 | 7 | 30 | 90;

/** Each panel comes from a different service; one being down doesn't blank the page. */
export type Panel<T> = { ok: true; data: T } | { ok: false; error: string };

export interface TermCount {
  term: string;
  count: number;
}

export interface ViewedProduct {
  productId: string;
  title: string;
  slug: string;
  status: string;
  /** Paise. */
  price: number;
  imageUrl: string | null;
  views: number;
  /** null when order data is unavailable. */
  orders: number | null;
  units: number | null;
  /** Orders per 100 views. */
  conversion: number | null;
}

export interface Engagement {
  totals: { views: number; searches: number; zeroSearches: number };
  series: { date: string; views: number; searches: number; zeroSearches: number }[];
  topSearches: TermCount[];
  zeroResultSearches: TermCount[];
  topViewed: ViewedProduct[];
}

export interface SoldProduct {
  productId: string;
  title: string;
  imageUrl: string | null;
  units: number;
  orders: number;
  /** Paise. */
  revenue: number;
}

export interface Sales {
  totals: { orders: number; units: number; revenue: number };
  top: SoldProduct[];
}

export interface WishlistedProduct {
  productId: string;
  title: string;
  imageUrl: string | null;
  /** Shoppers who have it saved right now. */
  saves: number;
  /** Of those, saved within the range. */
  recent: number;
}

export interface Wishlist {
  totals: { saves: number; recent: number };
  top: WishlistedProduct[];
}

export interface Insights {
  days: InsightRange;
  generatedAt: string;
  engagement: Panel<Engagement>;
  sales: Panel<Sales>;
  wishlist: Panel<Wishlist>;
}
