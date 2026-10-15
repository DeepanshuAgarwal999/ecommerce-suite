import { Injectable, Logger } from '@nestjs/common';
import { KafkaTopics, OrderStatus, PaymentMethod, SagaStatus } from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from '../order/order.service';

/**
 * The checkout saga.
 *
 * A checkout spans three services and there is no distributed transaction to make it
 * atomic, so it is modelled as a sequence of local transactions with compensations:
 *
 *   order created -> reserve stock -> take payment -> commit stock -> confirmed
 *                          |               |
 *                          v               v
 *                    release stock <- refund/void  (compensation)
 *
 * `SagaState` records how far an order got. That matters because a crash between two
 * steps is not a hypothetical - it is a Tuesday - and without the record, stock stays
 * reserved for an order nobody is going to pay for.
 *
 * COD is the special case: there is no payment step, so the saga completes as soon as
 * stock is reserved.
 */
@Injectable()
export class CheckoutSaga {
  private readonly logger = new Logger(CheckoutSaga.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
  ) {}

  /** Stock is held. Move to payment, or straight to confirmed for COD. */
  async onStockReserved(orderId: string, correlationId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { saga: true },
    });
    if (!order || !order.saga) return;
    // The saga has already moved past this step - a redelivered event, nothing to do.
    if (order.saga.inventoryReserved) return;

    await this.prisma.sagaState.update({
      where: { orderId },
      data: {
        inventoryReserved: true,
        status:
          order.paymentMethod === PaymentMethod.COD
            ? SagaStatus.COMPLETED
            : SagaStatus.AWAITING_PAYMENT,
        currentStep: 'INVENTORY_RESERVED',
      },
    });

    if (order.paymentMethod === PaymentMethod.COD) {
      // Nothing to collect up front, so the order is confirmed and the hold becomes a
      // permanent decrement via the same event the payment path uses.
      await this.prisma.$transaction(async (tx) => {
        await tx.sagaState.update({
          where: { orderId },
          data: { inventoryCommitted: true, currentStep: 'COD_CONFIRMED' },
        });
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.PAYMENT_CAPTURED,
            partitionKey: orderId,
            correlationId,
            payload: {
              paymentId: orderId,
              orderId,
              userId: order.userId,
              gateway: 'COD',
              status: 'CAPTURED',
              method: PaymentMethod.COD,
              amount: order.grandTotal,
              currency: order.currency,
            },
          }),
        });
      });

      await this.orders.applyStatus(orderId, OrderStatus.CONFIRMED, {
        reason: 'Cash on delivery order confirmed',
        correlationId,
      });
      return;
    }

    this.logger.log(`order ${orderId}: stock reserved, awaiting payment`);
  }

  /**
   * Stock could not be held. Nothing has been charged, so there is nothing to
   * compensate - the order just fails.
   */
  async onStockReservationFailed(
    orderId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    await this.prisma.sagaState.updateMany({
      where: { orderId },
      data: {
        status: SagaStatus.FAILED,
        currentStep: 'INVENTORY_FAILED',
        failureReason: reason.slice(0, 500),
      },
    });

    await this.orders.applyStatus(orderId, OrderStatus.CANCELLED, {
      reason: `Items unavailable: ${reason}`,
      correlationId,
    });

    this.logger.warn(`order ${orderId} cancelled - reservation failed: ${reason}`);
  }

  /** Money is in. Confirm the order; inventory commits the hold off the same event. */
  async onPaymentCaptured(orderId: string, paymentId: string, correlationId: string): Promise<void> {
    const saga = await this.prisma.sagaState.findUnique({ where: { orderId } });
    if (!saga || saga.paymentCaptured) return;

    await this.prisma.$transaction([
      this.prisma.sagaState.update({
        where: { orderId },
        data: {
          paymentCaptured: true,
          inventoryCommitted: true,
          status: SagaStatus.COMPLETED,
          currentStep: 'PAYMENT_CAPTURED',
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { paymentId, paidAt: new Date() },
      }),
    ]);

    await this.orders.applyStatus(orderId, OrderStatus.CONFIRMED, {
      reason: 'Payment received',
      correlationId,
    });

    this.logger.log(`order ${orderId} confirmed after payment ${paymentId}`);
  }

  /**
   * Payment failed. Compensate by releasing the hold - inventory-service listens for the
   * same `payment.failed` event, so this only has to move the order's own state.
   */
  async onPaymentFailed(orderId: string, reason: string, correlationId: string): Promise<void> {
    const saga = await this.prisma.sagaState.findUnique({ where: { orderId } });
    if (!saga || saga.status === SagaStatus.COMPENSATED) return;

    await this.prisma.sagaState.update({
      where: { orderId },
      data: {
        status: SagaStatus.COMPENSATED,
        currentStep: 'PAYMENT_FAILED',
        failureReason: reason.slice(0, 500),
        compensationStartedAt: new Date(),
        compensationDoneAt: new Date(),
      },
    });

    await this.orders.applyStatus(orderId, OrderStatus.PAYMENT_FAILED, {
      reason,
      correlationId,
    });
  }

  /**
   * Recovery sweep for sagas that stalled.
   *
   * A process can die between steps, and the event that would have advanced it is
   * already consumed. Anything past its deadline and not finished is driven to a
   * terminal state here - which is what guarantees held stock is eventually returned.
   */
  async recoverStalled(limit = 100): Promise<number> {
    const stalled = await this.prisma.sagaState.findMany({
      where: {
        status: { in: [SagaStatus.STARTED, SagaStatus.AWAITING_INVENTORY, SagaStatus.AWAITING_PAYMENT] },
        timeoutAt: { lt: new Date() },
      },
      take: limit,
      include: { order: { select: { id: true, status: true, userId: true } } },
    });

    let recovered = 0;

    for (const saga of stalled) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.sagaState.update({
            where: { id: saga.id },
            data: {
              status: SagaStatus.COMPENSATING,
              currentStep: 'TIMEOUT_RECOVERY',
              attempts: { increment: 1 },
              compensationStartedAt: new Date(),
              failureReason: 'Saga timed out awaiting a downstream response',
            },
          });

          // Ask inventory to let the stock go. Releasing is idempotent, so it is safe
          // even if the hold already expired on its own.
          await tx.outboxEvent.create({
            data: outboxRow({
              topic: KafkaTopics.STOCK_RELEASE_REQUESTED,
              partitionKey: saga.orderId,
              payload: { orderId: saga.orderId, reason: 'saga_timeout' },
            }),
          });
        });

        await this.orders.applyStatus(saga.orderId, OrderStatus.CANCELLED, {
          reason: 'Payment was not completed in time',
        });

        await this.prisma.sagaState.update({
          where: { id: saga.id },
          data: { status: SagaStatus.COMPENSATED, compensationDoneAt: new Date() },
        });

        recovered++;
      } catch (error) {
        this.logger.error(
          `failed to recover saga for order ${saga.orderId}: ${(error as Error).message}`,
        );
      }
    }

    return recovered;
  }
}
