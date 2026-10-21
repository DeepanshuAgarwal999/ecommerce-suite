import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { formatINR } from '@ecommerce/common';
import {
  ConsumerGroups,
  DevicePlatform,
  EventEnvelope,
  KafkaTopics,
  NotificationRequestedPayload,
  OrderCreatedPayload,
  OrderStatus,
  OrderStatusChangedPayload,
  OtpRequestedPayload,
  PaymentLifecyclePayload,
  RefundLifecyclePayload,
  TemplateKeys,
  UserRegisteredPayload,
  VendorLifecyclePayload,
  VendorStatus,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { DeviceService } from '../device/device.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

interface DeviceRegisteredPayload {
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceModel?: string;
  appVersion?: string;
}

/**
 * Turns platform events into customer messages.
 *
 * This is the only consumer in the system that talks to the outside world (SMS, push),
 * and it sits at the end of every flow - which is why it subscribes to so many topics.
 * Each handler is a mapping from an event to a template key plus variables; no business
 * decisions are made here.
 *
 * Two consumer groups: OTPs are latency-sensitive and must never queue behind a
 * promotional broadcast, so they get their own group and partitions.
 */
@Injectable()
export class NotificationConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly notifications: NotificationService,
    private readonly devices: DeviceService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Hot path: OTPs. High concurrency, nothing else in the group.
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.NOTIFICATION_DISPATCH,
        topics: [KafkaTopics.OTP_REQUESTED],
        partitionConcurrency: 8,
        maxRetries: 2,
      },
      {
        [KafkaTopics.OTP_REQUESTED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOtpRequested(envelope as EventEnvelope<OtpRequestedPayload>),
          ),
      },
    );

    // Everything else.
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.NOTIFICATION_LIFECYCLE,
        topics: [
          KafkaTopics.USER_REGISTERED,
          KafkaTopics.DEVICE_TOKEN_REGISTERED,
          KafkaTopics.ORDER_CREATED,
          KafkaTopics.ORDER_STATUS_CHANGED,
          KafkaTopics.PAYMENT_CAPTURED,
          KafkaTopics.PAYMENT_FAILED,
          KafkaTopics.REFUND_PROCESSED,
          KafkaTopics.VENDOR_APPROVED,
          KafkaTopics.VENDOR_REJECTED,
          KafkaTopics.NOTIFICATION_REQUESTED,
        ],
        partitionConcurrency: 4,
      },
      {
        [KafkaTopics.USER_REGISTERED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onUserRegistered(e as EventEnvelope<UserRegisteredPayload>),
          ),
        [KafkaTopics.DEVICE_TOKEN_REGISTERED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onDeviceRegistered(e as EventEnvelope<DeviceRegisteredPayload>),
          ),
        [KafkaTopics.ORDER_CREATED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onOrderCreated(e as EventEnvelope<OrderCreatedPayload>),
          ),
        [KafkaTopics.ORDER_STATUS_CHANGED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onOrderStatusChanged(e as EventEnvelope<OrderStatusChangedPayload>),
          ),
        [KafkaTopics.PAYMENT_CAPTURED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onPaymentCaptured(e as EventEnvelope<PaymentLifecyclePayload>),
          ),
        [KafkaTopics.PAYMENT_FAILED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onPaymentFailed(e as EventEnvelope<PaymentLifecyclePayload>),
          ),
        [KafkaTopics.REFUND_PROCESSED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onRefundProcessed(e as EventEnvelope<RefundLifecyclePayload>),
          ),
        [KafkaTopics.VENDOR_APPROVED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onVendorReviewed(e as EventEnvelope<VendorLifecyclePayload>),
          ),
        [KafkaTopics.VENDOR_REJECTED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onVendorReviewed(e as EventEnvelope<VendorLifecyclePayload>),
          ),
        [KafkaTopics.NOTIFICATION_REQUESTED]: (e) =>
          this.handleOnce(e as EventEnvelope, () =>
            this.onNotificationRequested(e as EventEnvelope<NotificationRequestedPayload>),
          ),
      },
    );
  }

  // --- handlers --------------------------------------------------------------

  private async onOtpRequested(envelope: EventEnvelope<OtpRequestedPayload>): Promise<void> {
    const { countryCode, mobile, otp, expiresInSeconds } = envelope.payload;
    const outcome = await this.notifications.sendOtpSms({
      e164: `${countryCode}${mobile}`,
      otp,
      expiresInSeconds,
      correlationId: envelope.correlationId,
    });
    if (outcome === 'failed') {
      // Throwing lets the consumer retry against the provider; after retries it lands in
      // the DLQ where an operator can see which numbers never got their code.
      throw new Error('SMS provider rejected the OTP message');
    }
  }

  private async onUserRegistered(envelope: EventEnvelope<UserRegisteredPayload>): Promise<void> {
    await this.notifications.dispatch({
      userId: envelope.payload.userId,
      templateKey: TemplateKeys.WELCOME,
      dedupeKey: `welcome:${envelope.payload.userId}`,
      correlationId: envelope.correlationId,
    });
  }

  private async onDeviceRegistered(envelope: EventEnvelope<DeviceRegisteredPayload>): Promise<void> {
    const p = envelope.payload;
    await this.devices.register({
      userId: p.userId,
      token: p.token,
      platform: p.platform ?? DevicePlatform.ANDROID,
      deviceId: p.deviceId,
      deviceModel: p.deviceModel,
      appVersion: p.appVersion,
    });
  }

  private async onOrderCreated(envelope: EventEnvelope<OrderCreatedPayload>): Promise<void> {
    const p = envelope.payload;
    await this.notifications.dispatch({
      userId: p.userId,
      templateKey: TemplateKeys.ORDER_PLACED,
      variables: { orderNumber: p.orderNumber, amount: formatINR(p.grandTotal).replace('₹', '') },
      data: { orderId: p.orderId, orderNumber: p.orderNumber },
      dedupeKey: `order:${p.orderId}:placed`,
      correlationId: envelope.correlationId,
    });
  }

  private async onOrderStatusChanged(
    envelope: EventEnvelope<OrderStatusChangedPayload>,
  ): Promise<void> {
    const p = envelope.payload;

    const templateFor: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.CONFIRMED]: TemplateKeys.ORDER_CONFIRMED,
      [OrderStatus.SHIPPED]: TemplateKeys.ORDER_SHIPPED,
      [OrderStatus.OUT_FOR_DELIVERY]: TemplateKeys.ORDER_OUT_FOR_DELIVERY,
      [OrderStatus.DELIVERED]: TemplateKeys.ORDER_DELIVERED,
      [OrderStatus.CANCELLED]: TemplateKeys.ORDER_CANCELLED,
    };

    const templateKey = templateFor[p.status];
    if (!templateKey) return;

    await this.notifications.dispatch({
      userId: p.userId,
      templateKey,
      variables: { orderNumber: p.orderNumber, reason: p.reason ?? '' },
      data: { orderId: p.orderId, orderNumber: p.orderNumber, status: p.status },
      // One row per (order, status): a retried transition updates rather than duplicates.
      dedupeKey: `order:${p.orderId}:${p.status}`,
      correlationId: envelope.correlationId,
    });
  }

  private async onPaymentCaptured(envelope: EventEnvelope<PaymentLifecyclePayload>): Promise<void> {
    const p = envelope.payload;
    if (p.gateway === 'COD') return;
    await this.notifications.dispatch({
      userId: p.userId,
      templateKey: TemplateKeys.PAYMENT_SUCCESS,
      variables: {
        orderNumber: (p as { orderNumber?: string }).orderNumber ?? p.orderId.slice(0, 8),
        amount: formatINR(p.amount).replace('₹', ''),
      },
      data: { orderId: p.orderId, paymentId: p.paymentId },
      dedupeKey: `payment:${p.paymentId}:captured`,
      correlationId: envelope.correlationId,
    });
  }

  private async onPaymentFailed(envelope: EventEnvelope<PaymentLifecyclePayload>): Promise<void> {
    const p = envelope.payload;
    await this.notifications.dispatch({
      userId: p.userId,
      templateKey: TemplateKeys.PAYMENT_FAILED,
      variables: { orderNumber: (p as { orderNumber?: string }).orderNumber ?? p.orderId.slice(0, 8) },
      data: { orderId: p.orderId, paymentId: p.paymentId },
      dedupeKey: `payment:${p.paymentId}:failed`,
      correlationId: envelope.correlationId,
    });
  }

  private async onRefundProcessed(envelope: EventEnvelope<RefundLifecyclePayload>): Promise<void> {
    const p = envelope.payload;
    await this.notifications.dispatch({
      userId: p.userId,
      templateKey: TemplateKeys.REFUND_PROCESSED,
      variables: { orderNumber: p.orderId.slice(0, 8), amount: formatINR(p.amount).replace('₹', '') },
      data: { orderId: p.orderId, refundId: p.refundId },
      dedupeKey: `refund:${p.refundId}`,
      correlationId: envelope.correlationId,
    });
  }

  private async onVendorReviewed(envelope: EventEnvelope<VendorLifecyclePayload>): Promise<void> {
    const p = envelope.payload;
    await this.notifications.dispatch({
      userId: p.userId,
      templateKey:
        p.status === VendorStatus.APPROVED ? TemplateKeys.VENDOR_APPROVED : TemplateKeys.VENDOR_REJECTED,
      variables: { businessName: p.businessName, reason: p.reason ?? '' },
      data: { vendorId: p.vendorId, status: p.status },
      dedupeKey: `vendor:${p.vendorId}:${p.status}`,
      correlationId: envelope.correlationId,
    });
  }

  /** Generic request from any service or an admin broadcast tool. */
  private async onNotificationRequested(
    envelope: EventEnvelope<NotificationRequestedPayload>,
  ): Promise<void> {
    const p = envelope.payload;
    const targets = p.userIds ?? (p.userId ? [p.userId] : []);

    // Bounded fan-out so one broadcast event cannot monopolise the consumer. Larger
    // audiences should be chunked into several events by the producer.
    for (const userId of targets.slice(0, 500)) {
      try {
        await this.notifications.dispatch({
          userId,
          templateKey: p.templateKey,
          variables: p.variables,
          channels: p.channels,
          dedupeKey: p.dedupeKey ? `${p.dedupeKey}:${userId}` : undefined,
          correlationId: envelope.correlationId,
        });
      } catch (error) {
        this.logger.warn(`broadcast to ${userId} failed: ${(error as Error).message}`);
      }
    }
  }

  // --- dedupe ----------------------------------------------------------------

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.NOTIFICATION_LIFECYCLE;
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
