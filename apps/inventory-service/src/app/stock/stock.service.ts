import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  CacheTtl,
  KafkaTopics,
  RequestContext,
  StockMovementType,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService, RedisService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/inventory';
import { PrismaService } from '../prisma/prisma.service';

export interface AvailabilityView {
  sku: string;
  available: number;
  inStock: boolean;
  /** Cheapest-to-serve warehouse for this SKU given the caller's pincode. */
  warehouseId: string | null;
  maxOrderQuantity: number | null;
}

/**
 * Stock levels and adjustments.
 *
 * `available` is always computed as `onHand - reserved`, never stored. A stored
 * available column is a third number that has to be kept in step with the other two,
 * and under concurrent checkouts it drifts - which shows up as overselling.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Availability for one SKU.
   *
   * Cached for only a few seconds. Long enough to absorb the burst of reads a product
   * page generates, short enough that "In stock" does not stay on screen minutes after
   * the last unit sold. The reservation system, not this cache, is what actually
   * prevents overselling.
   */
  async getAvailability(sku: string, pincode?: string): Promise<AvailabilityView> {
    const cached = await this.cache.wrap(
      CacheKeys.availability(sku),
      async () => {
        const rows = await this.prisma.stockItem.findMany({
          where: { sku, isActive: true },
          select: {
            warehouseId: true,
            onHand: true,
            reserved: true,
            allocated: true,
            maxOrderQuantity: true,
            warehouse: {
              select: { priority: true, servicePincodes: true, isActive: true, type: true },
            },
          },
        });
        return rows.filter((row) => row.warehouse.isActive);
      },
      { ttlSeconds: CacheTtl.AVAILABILITY },
    );

    const servable = pincode
      ? cached.filter((row) => row.warehouse.servicePincodes.includes(pincode))
      : cached;

    // Fall back to the full set rather than reporting "out of stock" when we simply have
    // no serviceability data for that pincode yet.
    const candidates = servable.length > 0 ? servable : cached;

    const available = candidates.reduce(
      (sum, row) => sum + Math.max(0, row.onHand - row.reserved - row.allocated),
      0,
    );

    const best = [...candidates]
      .filter((row) => row.onHand - row.reserved - row.allocated > 0)
      .sort((a, b) => a.warehouse.priority - b.warehouse.priority)[0];

    return {
      sku,
      available,
      inStock: available > 0,
      warehouseId: best?.warehouseId ?? null,
      maxOrderQuantity: best?.maxOrderQuantity ?? null,
    };
  }

  /** Batched availability for a cart or a listing page - one query, not one per SKU. */
  async getBulkAvailability(skus: string[], pincode?: string): Promise<AvailabilityView[]> {
    if (skus.length === 0) return [];
    return Promise.all(skus.map((sku) => this.getAvailability(sku, pincode)));
  }

  /**
   * Sets or creates the stock row for a SKU in a warehouse.
   *
   * Used by vendor onboarding and bulk uploads. `onHand` is set absolutely here, which is
   * only safe because this path is not concurrent with checkout - relative adjustments
   * go through `adjust` instead.
   */
  async upsertStock(
    input: {
      sku: string;
      variantId: string;
      productId: string;
      vendorId: string;
      warehouseId: string;
      onHand: number;
      reorderLevel?: number;
      maxOrderQuantity?: number;
    },
    ctx: RequestContext,
  ) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) throw AppException.notFound('Warehouse', input.warehouseId);

    const item = await this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.upsert({
        where: { sku_warehouseId: { sku: input.sku, warehouseId: input.warehouseId } },
        create: {
          sku: input.sku,
          variantId: input.variantId,
          productId: input.productId,
          vendorId: input.vendorId,
          warehouseId: input.warehouseId,
          onHand: input.onHand,
          reorderLevel: input.reorderLevel ?? 10,
          maxOrderQuantity: input.maxOrderQuantity,
          lastRestockedAt: new Date(),
        },
        update: {
          onHand: input.onHand,
          reorderLevel: input.reorderLevel,
          maxOrderQuantity: input.maxOrderQuantity,
          lastRestockedAt: new Date(),
        },
      });

      await tx.stockMovement.create({
        data: {
          sku: input.sku,
          warehouseId: input.warehouseId,
          type: StockMovementType.INBOUND,
          quantity: stock.onHand,
          onHandAfter: stock.onHand,
          reservedAfter: stock.reserved,
          referenceType: 'MANUAL_UPSERT',
          actorId: ctx.userId,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.STOCK_LEVEL_CHANGED,
          partitionKey: input.sku,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            sku: stock.sku,
            variantId: stock.variantId,
            warehouseId: stock.warehouseId,
            available: stock.onHand - stock.reserved,
            reserved: stock.reserved,
          },
        }),
      });

      return stock;
    });

    await this.cache.invalidate(CacheKeys.availability(input.sku));
    return item;
  }

  /**
   * Relative adjustment - a restock, a damage write-off, a stock count correction.
   *
   * The conditional `WHERE` clause is what makes this safe: a decrement that would push
   * `onHand` below what is already reserved simply matches zero rows, and we report the
   * conflict instead of creating negative stock.
   */
  async adjust(
    input: {
      sku: string;
      warehouseId: string;
      delta: number;
      type?: StockMovementType;
      reason?: string;
    },
    ctx: RequestContext,
  ) {
    const stock = await this.prisma.stockItem.findUnique({
      where: { sku_warehouseId: { sku: input.sku, warehouseId: input.warehouseId } },
    });
    if (!stock) throw AppException.notFound('Stock for SKU', input.sku);

    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.stockItem.updateMany({
        where: {
          id: stock.id,
          // Guard: never let onHand drop below the units already promised to customers.
          ...(input.delta < 0 ? { onHand: { gte: stock.reserved - input.delta } } : {}),
        },
        data: { onHand: { increment: input.delta } },
      });

      if (count === 0) {
        throw AppException.conflict(
          'Adjustment would take stock below the quantity already reserved',
        );
      }

      const fresh = await tx.stockItem.findUniqueOrThrow({ where: { id: stock.id } });

      await tx.stockMovement.create({
        data: {
          sku: input.sku,
          warehouseId: input.warehouseId,
          type: input.type ?? StockMovementType.ADJUSTMENT,
          quantity: input.delta,
          onHandAfter: fresh.onHand,
          reservedAfter: fresh.reserved,
          reason: input.reason,
          referenceType: 'ADJUSTMENT',
          actorId: ctx.userId,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.STOCK_LEVEL_CHANGED,
          partitionKey: input.sku,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            sku: fresh.sku,
            variantId: fresh.variantId,
            warehouseId: fresh.warehouseId,
            available: fresh.onHand - fresh.reserved,
            reserved: fresh.reserved,
          },
        }),
      });

      // Tell the vendor before the shelf is empty, not after.
      if (fresh.onHand - fresh.reserved <= fresh.reorderLevel) {
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.STOCK_LOW,
            partitionKey: input.sku,
            correlationId: ctx.correlationId,
            payload: {
              sku: fresh.sku,
              vendorId: fresh.vendorId,
              warehouseId: fresh.warehouseId,
              available: fresh.onHand - fresh.reserved,
              reorderLevel: fresh.reorderLevel,
            },
          }),
        });
      }

      return fresh;
    });

    await this.cache.invalidate(CacheKeys.availability(input.sku));
    return updated;
  }

  /**
   * Cross-vendor, cross-warehouse stock browser for the admin console.
   *
   * Every other read in this service answers "can I buy N of this SKU right now"
   * (cached, availability-shaped). This one answers "show me the stock table" - the
   * raw rows, uncached, because an admin adjusting inventory needs the current count,
   * not one that is up to `CacheTtl.AVAILABILITY` seconds stale. "Low stock only" is
   * deliberately not a filter here - it needs the `onHand - reserved <= reorderLevel`
   * comparison that only raw SQL can express efficiently, which `lowStockReport()`
   * already provides as its own bounded (LIMIT 500) query.
   */
  /** Stock for one product across every warehouse - admin product insights. */
  async productStock(productId: string) {
    const items = await this.prisma.stockItem.findMany({
      where: { productId, isActive: true },
      select: { sku: true, onHand: true, reserved: true, warehouseId: true },
    });
    const onHand = items.reduce((sum, item) => sum + item.onHand, 0);
    const reserved = items.reduce((sum, item) => sum + item.reserved, 0);
    return { onHand, reserved, available: Math.max(0, onHand - reserved), skus: items.length };
  }

  async listStock(query: {
    vendorId?: string;
    warehouseId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.StockItemWhereInput = {
      isActive: true,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.q ? { sku: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          sku: true,
          variantId: true,
          productId: true,
          vendorId: true,
          onHand: true,
          reserved: true,
          allocated: true,
          reorderLevel: true,
          maxOrderQuantity: true,
          lastRestockedAt: true,
          updatedAt: true,
          warehouse: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    const items = rows.map((row) => ({
      ...row,
      available: row.onHand - row.reserved - row.allocated,
    }));

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async listMovements(query: {
    sku?: string;
    referenceId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where = {
      ...(query.sku ? { sku: query.sku } : {}),
      ...(query.referenceId ? { referenceId: query.referenceId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Everything at or below its reorder level, for the vendor's restock queue.
   *
   * Raw SQL because the predicate compares two columns (`onHand - reserved <=
   * reorderLevel`), which Prisma's query builder cannot express. `Prisma.sql` still
   * parameterises the vendor id, so this is not string concatenation.
   */
  async lowStockReport(vendorId?: string) {
    const vendorFilter = vendorId
      ? Prisma.sql`AND "vendorId" = ${vendorId}::uuid`
      : Prisma.empty;

    return this.prisma.$queryRaw<
      { sku: string; warehouseId: string; available: number; reorderLevel: number }[]
    >(Prisma.sql`
      SELECT "sku",
             "warehouseId",
             ("onHand" - "reserved" - "allocated") AS "available",
             "reorderLevel"
      FROM "stock_items"
      WHERE "isActive" = true
        AND ("onHand" - "reserved" - "allocated") <= "reorderLevel"
        ${vendorFilter}
      ORDER BY ("onHand" - "reserved" - "allocated") ASC
      LIMIT 500
    `);
  }
}
