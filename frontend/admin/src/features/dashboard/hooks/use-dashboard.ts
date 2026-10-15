'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { dashboardApi } from '../api/dashboard-api';

export function useDashboardOverview() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: dashboardApi.overview,
    staleTime: 60_000,
  });
}

export function useOrderTrend(days = 14) {
  return useQuery({
    queryKey: queryKeys.dashboard.orderTrend(days),
    queryFn: () => dashboardApi.orderTrend(days),
    staleTime: 5 * 60_000,
  });
}
