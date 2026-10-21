import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  InventoryPatterns,
  RequestContext,
  StockMovementType,
  WarehouseType,
} from '@ecommerce/contracts';
import { StockService } from './stock/stock.service';
import { CreateWarehouseInput, WarehouseService } from './warehouse/warehouse.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly stock: StockService,
    private readonly warehouses: WarehouseService,
  ) {}

  @MessagePattern(InventoryPatterns.GET_AVAILABILITY)
  getAvailability(@Payload() msg: { sku: string; pincode?: string }) {
    return this.stock.getAvailability(msg.sku, msg.pincode);
  }

  @MessagePattern(InventoryPatterns.BULK_AVAILABILITY)
  bulkAvailability(@Payload() msg: { skus: string[]; pincode?: string }) {
    return this.stock.getBulkAvailability(msg.skus, msg.pincode);
  }

  @MessagePattern(InventoryPatterns.UPSERT_STOCK)
  upsertStock(
    @Payload()
    msg: {
      sku: string;
      variantId: string;
      productId: string;
      vendorId: string;
      warehouseId: string;
      onHand: number;
      reorderLevel?: number;
      maxOrderQuantity?: number;
      ctx: RequestContext;
    },
  ) {
    return this.stock.upsertStock(msg, msg.ctx);
  }

  @MessagePattern(InventoryPatterns.ADJUST_STOCK)
  adjustStock(
    @Payload()
    msg: {
      sku: string;
      warehouseId: string;
      delta: number;
      type?: StockMovementType;
      reason?: string;
      ctx: RequestContext;
    },
  ) {
    return this.stock.adjust(msg, msg.ctx);
  }

  @MessagePattern(InventoryPatterns.PRODUCT_STOCK)
  productStock(@Payload() msg: { productId: string }) {
    return this.stock.productStock(msg.productId);
  }

  @MessagePattern(InventoryPatterns.LIST_STOCK)
  listStock(
    @Payload()
    msg: { vendorId?: string; warehouseId?: string; q?: string; page?: number; limit?: number },
  ) {
    return this.stock.listStock(msg);
  }

  @MessagePattern(InventoryPatterns.LIST_MOVEMENTS)
  listMovements(
    @Payload() msg: { sku?: string; referenceId?: string; page?: number; limit?: number },
  ) {
    return this.stock.listMovements(msg);
  }

  @MessagePattern(InventoryPatterns.LOW_STOCK_REPORT)
  lowStock(@Payload() msg: { vendorId?: string }) {
    return this.stock.lowStockReport(msg.vendorId);
  }

  @MessagePattern(InventoryPatterns.LIST_WAREHOUSES)
  listWarehouses(@Payload() msg: { type?: WarehouseType; pincode?: string }) {
    return this.warehouses.list(msg);
  }

  @MessagePattern(InventoryPatterns.CREATE_WAREHOUSE)
  createWarehouse(@Payload() msg: CreateWarehouseInput) {
    return this.warehouses.create(msg);
  }
}
