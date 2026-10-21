'use client';

import { useQuery } from '@tanstack/react-query';
import { api, endpoints, queryKeys } from '@/lib/api';

export type HealthVerdict = 'star' | 'healthy' | 'needs_attention' | 'quality_risk' | 'underperforming' | 'too_early';

export interface MonthPoint {
  month: string;
  views: number;
  viewers: number;
  carts: number;
  wishlistSaves: number;
  orders: number;
  units: number;
  revenue: number;
  cancelledUnits: number;
  returnedUnits: number;
  conversionRate: number | null;
}

export interface ProductInsights {
  productId: string;
  months: number;
  generatedAt: string;
  listedAt: string;
  ageDays: number;
  monthly: MonthPoint[];
  funnel90: {
    views: number | null;
    viewers: number | null;
    carts: number | null;
    wishlists: number | null;
    orders: number | null;
    units: number | null;
    revenue: number | null;
    buyers: number | null;
  };
  lifetime: {
    views: number | null;
    trackingSince: string | null;
    buyers: number | null;
    repeatBuyers: number | null;
    firstSaleAt: string | null;
    lastSaleAt: string | null;
    savedNow: number | null;
  };
  category: {
    name: string | null;
    benchmark: {
      productsCompared: number;
      avgViews: number | null;
      viewToCartRate: number | null;
      viewToOrderRate: number | null;
      viewsRank: number | null;
      productsInCategory: number;
    } | null;
  };
  stock: { onHand: number; reserved: number; available: number; skus: number } | null;
  health: {
    verdict: HealthVerdict;
    score: number | null;
    scores: { demand: number | null; conversion: number | null; quality: number | null };
    metrics: {
      viewToCartRate: number | null;
      viewToOrderRate: number | null;
      returnRate: number | null;
      cancelRate: number | null;
      viewsTrendPct: number | null;
      dailyUnits: number;
      daysOfStock: number | null;
    };
    benchmarkUsed: 'category' | 'platform';
    reasons: string[];
    actions: string[];
  };
  unavailable: string[];
}

export function useProductInsights(productId: string, months: number) {
  return useQuery({
    queryKey: queryKeys.products.insights(productId, months),
    queryFn: () => api.get<ProductInsights>(endpoints.admin.productInsights(productId), { searchParams: { months } }),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}
