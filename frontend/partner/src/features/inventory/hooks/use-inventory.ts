'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { inventoryApi } from '../api/inventory-api';
import type { AdjustStockInput } from '../types';

export function useLowStock() {
  return useQuery({
    queryKey: queryKeys.inventory.lowStock(),
    queryFn: inventoryApi.lowStock,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses(),
    queryFn: inventoryApi.warehouses,
    staleTime: 10 * 60_000,
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustStockInput) => inventoryApi.adjust(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStock() });
    },
  });
}
