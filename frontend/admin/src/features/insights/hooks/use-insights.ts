'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { insightsApi } from '../api/insights-api';
import type { InsightRange } from '../types';

/** Server caches these for 2 minutes; refetching more often than that buys nothing. */
export function useInsights(days: InsightRange) {
  return useQuery({
    queryKey: queryKeys.insights.range(days),
    queryFn: () => insightsApi.get(days),
    staleTime: 120_000,
    placeholderData: keepPreviousData,
  });
}
