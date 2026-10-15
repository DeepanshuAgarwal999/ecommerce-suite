import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderStatus,
  PaymentLifecyclePayload,
  RefundLifecyclePayload,
  StockReservationFailedPayload,
  StockReservedPayload,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutSaga } from '../saga/checkout.saga';

/**
 * Feeds downstream facts into the saga.
 *
 * This is the only place order-service learns what inventory-service and payment-service
 * did. Each handler is a thin adapter from an event to a saga step; the decisions live
 * in `CheckoutSaga` so they can be unit-tested without Kafka.
 */
@Injectable()
export class OrderConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly saga: CheckoutSaga,
    private readonly orders: OrderService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.ORDER_SAGA,
        topics: [
          KafkaTopics.STOCK_RESERVED,
          KafkaTopics.STOCK_RESERVATION_FAILED,
          KafkaTopics.PAYMENT_CAPTURED,
          KafkaTopics.PAYMENT_FAILED,
          KafkaTopics.REFUND_PROCESSED,
        ],
        partitionConcurrency: 4,
      },
      {
        [KafkaTopics.STOCK_RESERVED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () => {
            const event = envelope as EventEnvelope<StockReservedPayload>;
            return this.saga.onStockReserved(event.payload.orderId, event.correlationId);
          }),
        [KafkaTopics.STOCK_RESERVATION_FAILED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () => {
            const event = envelope as EventEnvelope<StockReservationFailedPayload>;
            return this.saga.onStockReservationFailed(
              event.payload.orderId,
              event.payload.reason,
              event.correlationId,
            );
          }),
        [KafkaTopics.PAYMENT_CAPTURED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () => {
            const event = envelope as EventEnvelope<PaymentLifecyclePayload>;
            // COD confirmations are emitted by this service itself and already applied.
            if (event.payload.gateway === 'COD') return Promise.resolve();
            return this.saga.onPaymentCaptured(
              event.payload.orderId,
              event.payload.paymentId,
              event.correlationId,
            );
          }),
        [KafkaTopics.PAYMENT_FAILED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () => {
            const event = envelope as EventEnvelope<PaymentLifecyclePayload>;
            return this.saga.onPaymentFailed(
              event.payload.orderId,
              event.payload.failureReason ?? 'Payment failed',
              event.correlationId,
            );
          }),
        [KafkaTopics.REFUND_PROCESSED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onRefundProcessed(envelope as EventEnvelope<RefundLifecyclePayload>),
          ),
      },
    );
  }

  /** Money is back with the customer: close out the order. */
  private async onRefundProcessed(envelope: EventEnvelope<RefundLifecyclePayload>): Promise<void> {
    const { orderId, refundId } = envelope.payload;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    await this.prisma.returnRequest.updateMany({
      where: { orderId, refundId: null, status: 'RECEIVED' },
      data: { refundId },
    });

    if (order.status === OrderStatus.RETURNED || order.status === OrderStatus.CANCELLED) {
      await this.orders.applyStatus(orderId, OrderStatus.REFUNDED, {
        reason: 'Refund processed',
        correlationId: envelope.correlationId,
      });
    }
  }

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.ORDER_SAGA;
    if (!(await this.idempotency.markEventProcessed(group, envelope.eventId))) {
      this.logger.debug(`skipping duplicate event ${envelope.eventId}`);
      return;
    }

    const applied = await this.prisma.processedEvent.findUnique({
      where: { eventId: envelope.eventId },
      select: { eventId: true },
    });
    if (applied) return;

    await handler();
    await this.prisma.processedEvent.create({
      data: { eventId: envelope.eventId, consumerGroup: group },
    });
  }
}
