import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderStatusChangedPayload,
  PaymentLifecyclePayload,
  StockReserveRequestedPayload,
} from '@ecommerce/contracts';
import { AppException } from '@ecommerce/common';
import { KafkaConsumerService, KafkaProducerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';

/**
 * Inventory's half of the checkout saga.
 *
 * order-service asks for stock by publishing `inventory.reserve.requested`; this handler
 * answers with either `inventory.stock.reserved` or `inventory.stock.reservation-failed`.
 * Nothing here calls order-service back directly - the reply is a fact on the bus, which
 * is what lets either side restart mid-flow without losing the conversation.
 */
@Injectable()
export class InventoryConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(InventoryConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly producer: KafkaProducerService,
    private readonly reservations: ReservationService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.INVENTORY_SAGA,
        topics: [
          KafkaTopics.STOCK_RESERVE_REQUESTED,
          KafkaTopics.PAYMENT_CAPTURED,
          KafkaTopics.PAYMENT_FAILED,
          KafkaTopics.ORDER_CANCELLED,
        ],
        // Reservations are the hottest path in the saga; give it room to parallelise
        // across partitions while keeping per-order ordering.
        partitionConcurrency: 6,
      },
      {
        [KafkaTopics.STOCK_RESERVE_REQUESTED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onReserveRequested(envelope as EventEnvelope<StockReserveRequestedPayload>),
          ),
        [KafkaTopics.PAYMENT_CAPTURED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onPaymentCaptured(envelope as EventEnvelope<PaymentLifecyclePayload>),
          ),
        [KafkaTopics.PAYMENT_FAILED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onPaymentFailed(envelope as EventEnvelope<PaymentLifecyclePayload>),
          ),
        [KafkaTopics.ORDER_CANCELLED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOrderCancelled(envelope as EventEnvelope<OrderStatusChangedPayload>),
          ),
      },
    );
  }

  private async onReserveRequested(
    envelope: EventEnvelope<StockReserveRequestedPayload>,
  ): Promise<void> {
    const payload = envelope.payload;

    try {
      await this.reservations.reserve({
        orderId: payload.orderId,
        reservationId: payload.reservationId,
        userId: payload.userId,
        lines: payload.lines,
        holdSeconds: payload.holdSeconds,
        correlationId: envelope.correlationId,
      });
      // Success is published from inside the reservation transaction via the outbox, so
      // there is nothing to emit here.
    } catch (error) {
      // A stock shortage is an expected business outcome, not a processing failure. It
      // is reported to the saga as a fact rather than rethrown, which would send the
      // message to the DLQ and leave the order hanging.
      const details =
        error instanceof AppException
          ? ((error.details as { unavailable?: unknown[] })?.unavailable ?? [])
          : [];

      this.logger.warn(
        `reservation failed for order ${payload.orderId}: ${(error as Error).message}`,
      );

      await this.producer.emit(
        KafkaTopics.STOCK_RESERVATION_FAILED,
        payload.orderId,
        {
          orderId: payload.orderId,
          reservationId: payload.reservationId,
          reason: (error as Error).message,
          unavailable: details,
        },
        { correlationId: envelope.correlationId, causationId: envelope.eventId },
      );
    }
  }

  /** Payment settled: the hold becomes a permanent decrement. */
  private async onPaymentCaptured(
    envelope: EventEnvelope<PaymentLifecyclePayload>,
  ): Promise<void> {
    await this.reservations.commit(envelope.payload.orderId, envelope.correlationId);
  }

  /** Payment failed: give the units back immediately rather than waiting for expiry. */
  private async onPaymentFailed(envelope: EventEnvelope<PaymentLifecyclePayload>): Promise<void> {
    await this.reservations.release(
      envelope.payload.orderId,
      'payment_failed',
      envelope.correlationId,
    );
  }

  private async onOrderCancelled(
    envelope: EventEnvelope<OrderStatusChangedPayload>,
  ): Promise<void> {
    await this.reservations.release(
      envelope.payload.orderId,
      'order_cancelled',
      envelope.correlationId,
    );
  }

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.INVENTORY_SAGA;
    if (!(await this.idempotency.markEventProcessed(group, envelope.eventId))) {
      this.logger.debug(`skipping duplicate event ${envelope.eventId}`);
      return;
    }

    const applied = await this.prisma.processedEvent.findUnique({
      where: { eventId: envelope.eventId },
      select: { eventId: true },
    });
    if (applied) return;

    try {
      await handler();
      await this.prisma.processedEvent.create({
        data: { eventId: envelope.eventId, consumerGroup: group },
      });
    } catch (error) {
      // Let the retry / redelivery actually re-run it (see IdempotencyService.releaseEvent).
      await this.idempotency.releaseEvent(group, envelope.eventId);
      throw error;
    }
  }
}
