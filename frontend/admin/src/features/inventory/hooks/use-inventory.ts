'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { inventoryApi } from '../api/inventory-api';
import type { AdjustStockInput, StockListQuery, UpsertStockInput } from '../types';

export function useStock(query: StockListQuery) {
  return useQuery({
    queryKey: queryKeys.inventory.stock({ ...query }),
    queryFn: () => inventoryApi.listStock(query),
    placeholderData: (previous) => previous,
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: queryKeys.inventory.lowStock(),
    queryFn: inventoryApi.lowStock,
    staleTime: 30_000,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses(),
    queryFn: inventoryApi.warehouses,
    staleTime: 5 * 60_000,
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdjustStockInput) => inventoryApi.adjust(input),
    onSuccess: (stock) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success(`${stock.sku}: stock updated.`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not adjust stock.');
    },
  });
}

export function useUpsertStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertStockInput) => inventoryApi.upsert(input),
    onSuccess: (stock) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success(`${stock.sku}: stock set at ${stock.warehouse.name}.`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not set stock.');
    },
  });
}
