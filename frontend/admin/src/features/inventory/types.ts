export type WarehouseType = 'FULFILMENT_CENTRE' | 'DARK_STORE' | 'VENDOR_MANAGED';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  city: string;
  state: string;
  pincode: string;
  priority: number;
  isActive: boolean;
}

/** Mirrors StockService.listStock()'s return shape. */
export interface StockItem {
  id: string;
  sku: string;
  variantId: string;
  productId: string;
  vendorId: string;
  onHand: number;
  reserved: number;
  allocated: number;
  available: number;
  reorderLevel: number;
  maxOrderQuantity: number | null;
  lastRestockedAt: string | null;
  updatedAt: string;
  warehouse: { id: string; code: string; name: string; type: WarehouseType };
}

/** Mirrors StockService.lowStockReport()'s raw-SQL return shape. */
export interface LowStockRow {
  sku: string;
  warehouseId: string;
  available: number;
  reorderLevel: number;
}

export interface StockMovement {
  id: string;
  sku: string;
  warehouseId: string;
  type: string;
  quantity: number;
  onHandAfter: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface StockListQuery {
  page?: number;
  limit?: number;
  vendorId?: string;
  warehouseId?: string;
  q?: string;
}

export interface AdjustStockInput {
  sku: string;
  warehouseId: string;
  delta: number;
  type?: string;
  reason?: string;
}

/** Mirrors UpsertStockDto + the admin-only vendorId — sets absolute stock for a
 *  SKU at a warehouse, used to stock a brand-new variant for the first time. */
export interface UpsertStockInput {
  vendorId: string;
  sku: string;
  variantId: string;
  productId: string;
  warehouseId: string;
  onHand: number;
  reorderLevel?: number;
  maxOrderQuantity?: number;
}
