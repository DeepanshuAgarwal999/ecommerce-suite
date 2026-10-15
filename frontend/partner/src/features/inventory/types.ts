export interface LowStockRow {
  sku: string;
  warehouseId: string;
  available: number;
  reorderLevel: number;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: string;
}

/** Mirrors AdjustStockDto. A signed quantity: positive adds, negative removes. */
export interface AdjustStockInput {
  sku: string;
  warehouseId: string;
  delta: number;
}
