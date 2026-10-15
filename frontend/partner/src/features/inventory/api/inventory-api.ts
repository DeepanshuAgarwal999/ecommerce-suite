import { api, endpoints } from '@/lib/api';
import type { AdjustStockInput, LowStockRow, Warehouse } from '../types';

/** Mirrors apps/api-gateway vendor.controller's inventory routes. */
export const inventoryApi = {
  lowStock: () => api.get<LowStockRow[]>(endpoints.vendor.lowStock),
  warehouses: () => api.get<Warehouse[]>(endpoints.vendor.warehouses),
  adjust: (input: AdjustStockInput) => api.post<unknown>(endpoints.vendor.inventoryAdjust, input),
};
