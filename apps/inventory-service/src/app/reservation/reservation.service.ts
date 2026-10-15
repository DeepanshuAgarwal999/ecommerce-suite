import { Injectable, Logger } from '@nestjs/common';
import { AppException, ErrorCode } from '@ecommerce/common';
import {
  CacheKeys,
  KafkaTopics,
  ReservationLineInput,
  ReservationStatus,
  StockMovementType,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/inventory';
import { HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReserveInput {
  orderId: string;
  reservationId: string;
  userId: string;
  lines: ReservationLineInput[];
  holdSeconds: number;
  correlationId: string;
  pincode?: string;
}

export interface ReserveResult {
  reservationId: string;
  lines: (ReservationLineInput & { warehouseId: string })[];
  expiresAt: Date;
}

/**
 * Stock reservations - the mechanism that makes concurrent checkout safe.
 *
 * The rule this class exists to enforce: two customers must never both be told they got
 * the last unit. Three things combine to guarantee it.
 *
 * 1. Reserving is a *conditional* update:
 *
 *        UPDATE stock_items SET reserved = reserved + :qty
 *        WHERE id = :id AND onHand - reserved - allocated >= :qty
 *
 *    Postgres takes a row lock for the duration. Whichever transaction gets there second
 *    re-evaluates the predicate against the *updated* row and matches zero rows. No
 *    application-level check-then-act, so no window between the two.
 *
 * 2. Lines are locked in a deterministic order (sorted by stock item id). Two orders
 *    containing the same two SKUs in opposite orders would otherwise deadlock.
 *
 * 3. Holds expire. A customer who abandons a payment page must not strand stock forever,
 *    so every reservation carries a deadline and a sweeper releases what lapses.
 */
@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async reserve(input: ReserveInput): Promise<ReserveResult> {
    // One reservation per order makes a retried checkout idempotent.
    const existing = await this.prisma.reservation.findUnique({
      where: { orderId: input.orderId },
      include: { lines: true },
    });

    if (existing) {
      if (existing.status === ReservationStatus.HELD) {
        return {
          reservationId: existing.id,
          lines: existing.lines.map((line) => ({
            sku: line.sku,
            variantId: '',
            quantity: line.quantity,
            warehouseId: '',
          })),
          expiresAt: existing.expiresAt,
        };
      }
      throw AppException.conflict(
        `Order ${input.orderId} already has a ${existing.status} reservation`,
      );
    }

    const expiresAt = new Date(Date.now() + input.holdSeconds * 1000);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const picked = await this.pickWarehouses(tx, input.lines, input.pincode);

        // Deterministic lock order across concurrent transactions - see (2) above.
        picked.sort((a, b) => a.stockItemId.localeCompare(b.stockItemId));

        const reservation = await tx.reservation.create({
          data: {
            id: input.reservationId,
            orderId: input.orderId,
            userId: input.userId,
            status: ReservationStatus.HELD,
            expiresAt,
          },
        });

        const unavailable: { sku: string; requested: number; available: number }[] = [];

        for (const line of picked) {
          // Raw SQL because the predicate compares columns to each other, which Prisma's
          // query builder cannot express. This is the atomic guard described above: one
          // statement, evaluated under the row lock, that either reserves the full
          // quantity or affects nothing.
          const affected = await tx.$executeRaw`
            UPDATE "stock_items"
            SET "reserved" = "reserved" + ${line.quantity},
                "updatedAt" = NOW()
            WHERE "id" = ${line.stockItemId}::uuid
              AND "isActive" = true
              AND ("onHand" - "reserved" - "allocated") >= ${line.quantity}
          `;

          if (affected === 0) {
            const current = await tx.stockItem.findUnique({
              where: { id: line.stockItemId },
              select: { onHand: true, reserved: true, allocated: true },
            });
            unavailable.push({
              sku: line.sku,
              requested: line.quantity,
              available: current
                ? Math.max(0, current.onHand - current.reserved - current.allocated)
                : 0,
            });
            continue;
          }

          const fresh = await tx.stockItem.findUniqueOrThrow({
            where: { id: line.stockItemId },
            select: { onHand: true, reserved: true },
          });

          await tx.reservationLine.create({
            data: {
              reservationId: reservation.id,
              stockItemId: line.stockItemId,
              sku: line.sku,
              quantity: line.quantity,
            },
          });

          await tx.stockMovement.create({
            data: {
              sku: line.sku,
              warehouseId: line.warehouseId,
              type: StockMovementType.RESERVE,
              quantity: -line.quantity,
              onHandAfter: fresh.onHand,
              reservedAfter: fresh.reserved,
              referenceType: 'ORDER',
              referenceId: input.orderId,
            },
          });
        }

        if (unavailable.length > 0) {
          // Throwing rolls back every increment made above - partial reservations would
          // hold stock for an order that can never be fulfilled.
          throw new AppException(
            ErrorCode.INSUFFICIENT_STOCK,
            'Some items are no longer available in the requested quantity',
            HttpStatus.CONFLICT,
            { details: { unavailable } },
          );
        }

        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.STOCK_RESERVED,
            partitionKey: input.orderId,
            correlationId: input.correlationId,
            payload: {
              orderId: input.orderId,
              reservationId: reservation.id,
              lines: picked.map((line) => ({
                sku: line.sku,
                variantId: line.variantId,
                quantity: line.quantity,
                warehouseId: line.warehouseId,
              })),
              expiresAt: expiresAt.toISOString(),
            },
          }),
        });

        return {
          reservationId: reservation.id,
          lines: picked.map((line) => ({
            sku: line.sku,
            variantId: line.variantId,
            quantity: line.quantity,
            warehouseId: line.warehouseId,
          })),
          expiresAt,
        };
      },
      // Reservation contends on hot rows; a bounded wait plus a hard timeout keeps a
      // pile-up from turning into a connection-pool exhaustion.
      { timeout: 15_000, maxWait: 5_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    await this.invalidate(input.lines.map((line) => line.sku));
    this.logger.log(`reserved ${result.lines.length} lines for order ${input.orderId}`);
    return result;
  }

  /**
   * Converts a hold into a permanent decrement, once payment has actually settled.
   *
   * `onHand` drops and `reserved` drops by the same amount, so availability is unchanged
   * - the units were already invisible to other customers. This is the point of no
   * return for the stock.
   */
  async commit(orderId: string, correlationId: string): Promise<{ ok: true }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { orderId },
      include: { lines: { include: { stockItem: true } } },
    });

    if (!reservation) throw AppException.notFound('Reservation for order', orderId);
    // Idempotent: a redelivered payment event must not decrement stock twice.
    if (reservation.status === ReservationStatus.COMMITTED) return { ok: true };
    if (reservation.status !== ReservationStatus.HELD) {
      throw AppException.conflict(`Reservation is ${reservation.status} and cannot be committed`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of reservation.lines) {
        await tx.stockItem.update({
          where: { id: line.stockItemId },
          data: {
            onHand: { decrement: line.quantity },
            reserved: { decrement: line.quantity },
          },
        });

        const fresh = await tx.stockItem.findUniqueOrThrow({ where: { id: line.stockItemId } });

        await tx.stockMovement.create({
          data: {
            sku: line.sku,
            warehouseId: line.stockItem.warehouseId,
            type: StockMovementType.COMMIT,
            quantity: -line.quantity,
            onHandAfter: fresh.onHand,
            reservedAfter: fresh.reserved,
            referenceType: 'ORDER',
            referenceId: orderId,
          },
        });
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.COMMITTED, committedAt: new Date() },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.STOCK_COMMITTED,
          partitionKey: orderId,
          correlationId,
          payload: { orderId, reservationId: reservation.id },
        }),
      });
    });

    await this.invalidate(reservation.lines.map((line) => line.sku));
    return { ok: true };
  }

  /**
   * Returns held units to the pool. The compensating action of the checkout saga -
   * called when payment fails, the customer cancels, or the hold expires.
   */
  async release(orderId: string, reason: string, correlationId: string): Promise<{ ok: true }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { orderId },
      include: { lines: { include: { stockItem: true } } },
    });

    if (!reservation) return { ok: true };
    // Already released or committed - nothing to undo. Silence here is what makes the
    // compensation safe to retry.
    if (reservation.status !== ReservationStatus.HELD) return { ok: true };

    await this.prisma.$transaction(async (tx) => {
      for (const line of reservation.lines) {
        await tx.stockItem.update({
          where: { id: line.stockItemId },
          data: { reserved: { decrement: line.quantity } },
        });

        const fresh = await tx.stockItem.findUniqueOrThrow({ where: { id: line.stockItemId } });

        await tx.stockMovement.create({
          data: {
            sku: line.sku,
            warehouseId: line.stockItem.warehouseId,
            type: StockMovementType.RELEASE,
            quantity: line.quantity,
            onHandAfter: fresh.onHand,
            reservedAfter: fresh.reserved,
            referenceType: 'ORDER',
            referenceId: orderId,
            reason,
          },
        });
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: new Date(),
          releaseReason: reason,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.STOCK_RELEASED,
          partitionKey: orderId,
          correlationId,
          payload: { orderId, reservationId: reservation.id, reason },
        }),
      });
    });

    await this.invalidate(reservation.lines.map((line) => line.sku));
    this.logger.log(`released reservation for order ${orderId} (${reason})`);
    return { ok: true };
  }

  /**
   * Chooses which warehouse serves each line.
   *
   * Preference order: a warehouse that serves the delivery pincode and has the stock,
   * then any warehouse with the stock. Lower `priority` wins, which is how dark stores
   * get picked ahead of regional fulfilment centres for quick commerce.
   */
  private async pickWarehouses(
    tx: Prisma.TransactionClient,
    lines: ReservationLineInput[],
    pincode?: string,
  ) {
    const skus = lines.map((line) => line.sku);
    const stock = await tx.stockItem.findMany({
      where: { sku: { in: skus }, isActive: true },
      include: { warehouse: { select: { priority: true, servicePincodes: true, isActive: true } } },
    });

    return lines.map((line) => {
      const candidates = stock
        .filter(
          (row) =>
            row.sku === line.sku &&
            row.warehouse.isActive &&
            row.onHand - row.reserved - row.allocated >= line.quantity &&
            (!line.warehouseId || row.warehouseId === line.warehouseId),
        )
        .sort((a, b) => {
          if (pincode) {
            const aServes = a.warehouse.servicePincodes.includes(pincode) ? 0 : 1;
            const bServes = b.warehouse.servicePincodes.includes(pincode) ? 0 : 1;
            if (aServes !== bServes) return aServes - bServes;
          }
          return a.warehouse.priority - b.warehouse.priority;
        });

      const chosen = candidates[0];
      if (!chosen) {
        throw new AppException(
          ErrorCode.INSUFFICIENT_STOCK,
          `${line.sku} is not available in the requested quantity`,
          HttpStatus.CONFLICT,
          { details: { unavailable: [{ sku: line.sku, requested: line.quantity, available: 0 }] } },
        );
      }

      return {
        stockItemId: chosen.id,
        sku: line.sku,
        variantId: chosen.variantId,
        quantity: line.quantity,
        warehouseId: chosen.warehouseId,
      };
    });
  }

  private async invalidate(skus: string[]): Promise<void> {
    await this.cache.invalidate(...[...new Set(skus)].map((sku) => CacheKeys.availability(sku)));
  }
}
