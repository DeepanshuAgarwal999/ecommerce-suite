import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderStatusChangedPayload,
  PaymentGateway,
  PaymentStatus,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { RefundService } from '../refund/refund.service';

interface RefundRequestedPayload {
  orderId: string;
  paymentId?: string | null;
  userId: string;
  amount: number;
  currency: string;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Payment's half of the saga: refunds triggered by order events.
 *
 * A cancelled order that was already paid, or a return that has been received, both
 * arrive here as events and turn into gateway refunds. Money never moves in response
 * to an HTTP call from another service - only in response to a durable fact.
 */
@Injectable()
export class PaymentConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly refunds: RefundService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.PAYMENT_SAGA,
        topics: [KafkaTopics.REFUND_REQUESTED, KafkaTopics.ORDER_CANCELLED],
      },
      {
        [KafkaTopics.REFUND_REQUESTED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onRefundRequested(envelope as EventEnvelope<RefundRequestedPayload>),
          ),
        [KafkaTopics.ORDER_CANCELLED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOrderCancelled(envelope as EventEnvelope<OrderStatusChangedPayload>),
          ),
      },
    );
  }

  private async onRefundRequested(envelope: EventEnvelope<RefundRequestedPayload>): Promise<void> {
    const p = envelope.payload;
    await this.refunds.create(
      {
        orderId: p.orderId,
        paymentId: p.paymentId ?? undefined,
        amount: p.amount,
        reason: p.reason,
        referenceType: p.referenceType,
        referenceId: p.referenceId,
        // Keyed on the event so a redelivery is a replay, not a second refund.
        idempotencyKey: `event:${envelope.eventId}`,
      },
      { correlationId: envelope.correlationId, userId: envelope.actorId },
    );
  }

  /** A paid order that is cancelled gets a full automatic refund. */
  private async onOrderCancelled(
    envelope: EventEnvelope<OrderStatusChangedPayload>,
  ): Promise<void> {
    const { orderId } = envelope.payload;

    const captured = await this.prisma.payment.findFirst({
      where: { orderId, status: PaymentStatus.CAPTURED, gateway: PaymentGateway.RAZORPAY },
    });
    if (!captured) return;

    await this.refunds.create(
      {
        orderId,
        paymentId: captured.id,
        amount: captured.capturedAmount - captured.refundedAmount,
        reason: 'Order cancelled',
        referenceType: 'ORDER_CANCELLATION',
        referenceId: orderId,
        idempotencyKey: `cancel:${orderId}`,
      },
      { correlationId: envelope.correlationId, userId: envelope.actorId },
    );
  }

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.PAYMENT_SAGA;
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
