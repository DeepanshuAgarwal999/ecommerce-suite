import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types/pagination';
import type {
  AdjustStockInput,
  LowStockRow,
  StockItem,
  StockListQuery,
  StockMovement,
  UpsertStockInput,
  Warehouse,
} from '../types';

export const inventoryApi = {
  listStock: (query: StockListQuery) =>
    api.get<Paginated<StockItem>>(endpoints.admin.inventory, { searchParams: { ...query } }),

  lowStock: () => api.get<LowStockRow[]>(endpoints.admin.lowStock),

  movements: (query: { sku?: string; page?: number; limit?: number }) =>
    api.get<Paginated<StockMovement>>(endpoints.admin.inventoryMovements, { searchParams: query }),

  adjust: (input: AdjustStockInput) => api.post<StockItem>(endpoints.admin.inventoryAdjust, input),

  /** Sets absolute stock for a SKU — first-time stocking a new variant. */
  upsert: (input: UpsertStockInput) => api.post<StockItem>(endpoints.admin.inventory, input),

  warehouses: () => api.get<Warehouse[]>(endpoints.admin.warehouses),
};
