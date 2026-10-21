import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderCreatedPayload,
  OrderStatusChangedPayload,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { randomUUID } from 'node:crypto';
import { CartService } from '../cart/cart.service';
import { CouponService } from '../coupon/coupon.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reacts to order events.
 *
 * The cart is emptied when the order actually exists, not when checkout starts - so a
 * checkout that fails at payment leaves the basket intact and the customer can retry
 * without rebuilding it.
 */
@Injectable()
export class CartConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(CartConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly carts: CartService,
    private readonly coupons: CouponService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.CART_SYNC,
        topics: [KafkaTopics.ORDER_CREATED, KafkaTopics.ORDER_CANCELLED],
      },
      {
        [KafkaTopics.ORDER_CREATED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOrderCreated(envelope as EventEnvelope<OrderCreatedPayload>),
          ),
        [KafkaTopics.ORDER_CANCELLED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOrderCancelled(envelope as EventEnvelope<OrderStatusChangedPayload>),
          ),
      },
    );
  }

  private async onOrderCreated(envelope: EventEnvelope<OrderCreatedPayload>): Promise<void> {
    const { userId, orderId, basket } = envelope.payload;
    // A DIRECT order ("Buy now", browser cart) never came from the server cart - leave it alone.
    if (basket === 'DIRECT') return;
    await this.carts.markConverted(userId, orderId, {
      correlationId: envelope.correlationId ?? randomUUID(),
      userId,
    });
  }

  /** Cancelling frees the coupon so the customer can use it again. */
  private async onOrderCancelled(
    envelope: EventEnvelope<OrderStatusChangedPayload>,
  ): Promise<void> {
    await this.coupons.release(envelope.payload.orderId);
    await this.carts.unlock(envelope.payload.userId);
  }

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.CART_SYNC;
    if (!(await this.idempotency.markEventProcessed(group, envelope.eventId))) return;

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
