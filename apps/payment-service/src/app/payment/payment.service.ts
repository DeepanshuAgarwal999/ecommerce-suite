import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { AppException, ErrorCode, rpc } from '@ecommerce/common';
import {
  buildPaginationMeta,
  KafkaTopics,
  OrderPatterns,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  RequestContext,
  ServiceTokens,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { Prisma } from '@ecom-db/payment';
import { LockService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import type { GatewayPayment, PaymentProvider } from '../providers/payment-provider';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';

interface OrderView {
  id: string;
  orderNumber: string;
  userId: string;
  userMobile: string;
  userEmail: string | null;
  status: OrderStatus;
  grandTotal: number;
  currency: string;
  paymentMethod: PaymentMethod;
  shippingAddress?: { fullName?: string } | null;
  saga?: { inventoryReserved: boolean; status: string } | null;
}

type PaymentRow = Prisma.PaymentGetPayload<object>;

/** Statuses only move forward; a late "authorized" after "captured" is stale, not a regression. */
const RANK: Record<PaymentStatus, number> = {
  CREATED: 0,
  PENDING: 1,
  AUTHORIZED: 2,
  CAPTURED: 3,
  FAILED: 3,
  CANCELLED: 3,
  REFUND_PENDING: 4,
  PARTIALLY_REFUNDED: 5,
  REFUNDED: 6,
};

/** When several attempts exist on one gateway order, the one that matters most. */
const OUTCOME_PRIORITY: Partial<Record<PaymentStatus, number>> = { CAPTURED: 3, AUTHORIZED: 2, FAILED: 1 };

/**
 * Payment lifecycle - gateway-agnostic. Every gateway call goes through a
 * PaymentProvider adapter (see providers/); this class never sees a gateway SDK,
 * status string or signature scheme.
 *
 * Trust model: the client's word is never final. The browser reports "paid", the
 * adapter verifies its proof so the UI can say "success" at once - but the order only
 * ships on the gateway's own word (fetchPayment, the webhook, or reconciliation).
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly rpcTimeout: number;
  private readonly merchantName: string;
  private readonly checkoutTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly locks: LockService,
    config: ConfigService,
    @Inject(ServiceTokens.ORDER) private readonly orders: ClientProxy,
  ) {
    this.rpcTimeout = config.get<number>('observability.rpcTimeoutMs', 10_000);
    this.merchantName = config.get<string>('payments.merchantName', 'nestora');
    this.checkoutTtlMs = config.get<number>('payments.checkoutTtlMinutes', 15) * 60_000;
  }

  /**
   * Starts (or resumes) an online payment for an order and returns what the client's
   * adapter for the active gateway needs to open its checkout widget. The amount comes
   * from order-service, never from the client.
   */
  async createCheckout(userId: string, orderId: string, idempotencyKey: string | undefined, ctx: RequestContext) {
    const order = await rpc<OrderView>(
      this.orders,
      OrderPatterns.GET_ORDER,
      { orderId, userId },
      { timeoutMs: this.rpcTimeout, service: 'order-service' },
    );
    const customer = { name: order.shippingAddress?.fullName, contact: order.userMobile, email: order.userEmail };

    if (idempotencyKey) {
      const replay = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (replay) return this.toCheckoutView(replay, customer);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new AppException(
        ErrorCode.INVALID_ORDER_TRANSITION,
        `Order is ${order.status}; payment can only be started for orders awaiting payment`,
        HttpStatus.CONFLICT,
      );
    }
    if (order.paymentMethod === PaymentMethod.COD) {
      throw AppException.validation('Cash-on-delivery orders do not need an online payment');
    }

    // Block stock before taking money (how Flipkart/Amazon do it). Inventory reserves
    // asynchronously right after the order is created; if we let the shopper pay first,
    // a fast UPI payment can be captured before the hold exists, the capture can't be
    // committed against it, and the hold later expires - freeing stock for a paid order.
    // Usually ready within a second; the client retries this call on this error code.
    if (order.saga && !order.saga.inventoryReserved) {
      throw new AppException(
        ErrorCode.STOCK_RESERVATION_PENDING,
        'Reserving your items - please wait a moment',
        HttpStatus.CONFLICT,
        { retryAfterSeconds: 1 },
      );
    }

    // One checkout at a time per order: two tabs / a double-tap racing here would both
    // find no open payment and each open a gateway order - the setup for a double
    // charge. The second caller waits, then resumes the first one's payment below.
    const lock = await this.locks.acquire(`lock:payment:checkout:${orderId}`, { ttlSeconds: 30, waitMs: 10_000 });
    if (!lock) {
      throw new AppException(ErrorCode.CONFLICT, 'A payment for this order is already being set up', HttpStatus.CONFLICT);
    }
    try {
      return await this.openCheckout(order, userId, idempotencyKey, ctx, customer);
    } finally {
      await lock.release();
    }
  }

  private async openCheckout(
    order: OrderView,
    userId: string,
    idempotencyKey: string | undefined,
    ctx: RequestContext,
    customer: { name?: string; contact?: string; email?: string | null },
  ) {
    const orderId = order.id;
    const provider = this.providers.active();

    // Resume a still-payable attempt rather than opening a second gateway order for the
    // same purchase (two open orders is how a customer gets charged twice). Only on the
    // active gateway - after a gateway switch the client can't open the old widget.
    const live = await this.prisma.payment.findFirst({
      where: {
        orderId,
        gateway: provider.gateway,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (live) return this.toCheckoutView(live, customer);

    const currency = order.currency || 'INR';
    const gatewayOrder = await provider.createOrder({
      amount: order.grandTotal,
      currency,
      receipt: order.orderNumber,
      notes: { orderId, userId },
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          orderNumber: order.orderNumber,
          userId,
          gateway: provider.gateway,
          status: PaymentStatus.CREATED,
          amount: order.grandTotal,
          currency,
          gatewayOrderId: gatewayOrder.gatewayOrderId,
          idempotencyKey,
          // Gateway orders stay payable longer, but the stock hold does not.
          expiresAt: new Date(Date.now() + this.checkoutTtlMs),
        },
      });
      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.PAYMENT_INITIATED,
          partitionKey: orderId,
          correlationId: ctx.correlationId,
          actorId: userId,
          payload: this.toEventPayload(created),
        }),
      });
      return created;
    });

    this.logger.log(`checkout ${payment.id} opened on ${provider.name} for order ${order.orderNumber}`);
    return this.toCheckoutView(payment, customer);
  }

  /**
   * The client reports the checkout widget's result. The gateway's adapter checks the
   * proof; we then ask the gateway for the payment's real state rather than assuming.
   */
  async confirm(userId: string, input: { paymentId: string; gatewayResponse: Record<string, unknown> }, ctx: RequestContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment || payment.userId !== userId || !payment.gatewayOrderId) {
      throw AppException.notFound('Payment', input.paymentId);
    }
    if (RANK[payment.status] >= RANK.CAPTURED) return this.toStatusView(payment);

    const provider = this.providers.forGateway(payment.gateway);
    const confirmation = provider.verifyClientConfirmation(payment.gatewayOrderId, input.gatewayResponse ?? {});

    if (!confirmation) {
      await this.prisma.paymentAttempt.create({
        data: { paymentId: payment.id, status: 'CONFIRMATION_INVALID', errorCode: 'SIGNATURE_MISMATCH' },
      });
      throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID, 'Payment verification failed', HttpStatus.BAD_REQUEST);
    }

    const gatewayPayment = await provider.fetchPayment(confirmation.gatewayPaymentId);
    return this.toStatusView(await this.applyGatewayState(payment.id, gatewayPayment, confirmation.signature ?? null, ctx));
  }

  /**
   * Applies a gateway's view of a payment to our record. Shared by the client confirm,
   * webhooks and reconciliation so all paths converge on one state machine.
   * Idempotent: the same state twice changes nothing and emits nothing.
   */
  async applyGatewayState(paymentId: string, gatewayPayment: GatewayPayment, signature: string | null, ctx: RequestContext) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // A payment proven for a different gateway order (e.g. replaying a cheaper order's
    // receipt) or for a different amount must never confirm this order.
    if (gatewayPayment.gatewayOrderId && payment.gatewayOrderId && gatewayPayment.gatewayOrderId !== payment.gatewayOrderId) {
      this.logger.error(`payment ${paymentId}: gateway payment belongs to ${gatewayPayment.gatewayOrderId}, not ${payment.gatewayOrderId}`);
      throw new AppException(ErrorCode.PAYMENT_FAILED, 'Payment does not belong to this order', HttpStatus.CONFLICT);
    }
    if (gatewayPayment.amount !== payment.amount) {
      this.logger.error(`amount mismatch on ${paymentId}: expected ${payment.amount}, gateway says ${gatewayPayment.amount}`);
      throw new AppException(ErrorCode.PAYMENT_FAILED, 'Payment amount does not match the order', HttpStatus.CONFLICT);
    }

    // A declined attempt is not a failed payment while the checkout window is open:
    // gateways let the shopper retry (card declined -> pay by UPI) against the same
    // gateway order. Record the attempt and the reason, keep the payment open, emit
    // nothing - otherwise the first decline would cancel the order and free its stock
    // while the shopper is still paying. The payment fails for real only when the
    // window closes unpaid (see reconcileStale).
    if (
      gatewayPayment.status === PaymentStatus.FAILED &&
      RANK[payment.status] < RANK.CAPTURED &&
      payment.expiresAt &&
      payment.expiresAt.getTime() > Date.now()
    ) {
      return this.recordDeclinedAttempt(payment, gatewayPayment);
    }

    const nextStatus = gatewayPayment.status;
    if (nextStatus === payment.status || RANK[nextStatus] < RANK[payment.status]) return payment;

    return this.prisma.$transaction(async (tx) => {
      // Compare-and-set on the status we read: when the client confirm and the webhook
      // (or reconciliation) land together, exactly one applies the transition and emits
      // its event; the other sees count 0 and returns the winner's result.
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: payment.status },
        data: { updatedAt: new Date() },
      });
      if (count === 0) return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: nextStatus,
          method: gatewayPayment.method,
          gatewayPaymentId: gatewayPayment.gatewayPaymentId,
          gatewaySignature: signature ?? undefined,
          methodDetails: (gatewayPayment.methodDetails ?? undefined) as never,
          capturedAmount: nextStatus === PaymentStatus.CAPTURED ? gatewayPayment.amount : undefined,
          authorizedAt: nextStatus === PaymentStatus.AUTHORIZED ? new Date() : undefined,
          capturedAt: nextStatus === PaymentStatus.CAPTURED ? new Date() : undefined,
          failedAt: nextStatus === PaymentStatus.FAILED ? new Date() : undefined,
          failureCode: gatewayPayment.errorCode,
          failureReason: gatewayPayment.errorReason,
        },
      });

      await tx.paymentAttempt.create({
        data: {
          paymentId,
          method: gatewayPayment.method,
          status: nextStatus,
          gatewayPaymentId: gatewayPayment.gatewayPaymentId,
          errorCode: gatewayPayment.errorCode,
          errorReason: gatewayPayment.errorReason,
          rawResponse: gatewayPayment.raw as never,
        },
      });

      const topic =
        nextStatus === PaymentStatus.CAPTURED
          ? KafkaTopics.PAYMENT_CAPTURED
          : nextStatus === PaymentStatus.AUTHORIZED
            ? KafkaTopics.PAYMENT_AUTHORIZED
            : nextStatus === PaymentStatus.FAILED
              ? KafkaTopics.PAYMENT_FAILED
              : null;
      if (topic) {
        await tx.outboxEvent.create({
          data: outboxRow({
            topic,
            partitionKey: updated.orderId,
            correlationId: ctx.correlationId,
            actorId: ctx.userId,
            payload: this.toEventPayload(updated),
          }),
        });
      }

      this.logger.log(`payment ${paymentId} -> ${nextStatus} (${gatewayPayment.gatewayPaymentId})`);
      return updated;
    });
  }

  private async recordDeclinedAttempt(payment: PaymentRow, gatewayPayment: GatewayPayment) {
    const already = await this.prisma.paymentAttempt.findFirst({
      where: { paymentId: payment.id, gatewayPaymentId: gatewayPayment.gatewayPaymentId, status: PaymentStatus.FAILED },
      select: { id: true },
    });
    const [updated] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PENDING,
          failureCode: gatewayPayment.errorCode ?? 'DECLINED',
          failureReason: gatewayPayment.errorReason ?? 'The payment was declined',
        },
      }),
      ...(already
        ? []
        : [
            this.prisma.paymentAttempt.create({
              data: {
                paymentId: payment.id,
                method: gatewayPayment.method,
                status: PaymentStatus.FAILED,
                gatewayPaymentId: gatewayPayment.gatewayPaymentId,
                errorCode: gatewayPayment.errorCode,
                errorReason: gatewayPayment.errorReason,
                rawResponse: gatewayPayment.raw as never,
              },
            }),
          ]),
    ]);
    this.logger.log(`payment ${payment.id}: attempt declined (${gatewayPayment.errorCode ?? 'unknown'}), still retryable`);
    return updated;
  }

  /** The checkout window closed with nothing paid: fail it, so the order saga cancels and frees stock. */
  private async expire(payment: PaymentRow): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Only if still open - a capture that landed meanwhile must win.
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status },
        data: { updatedAt: new Date() },
      });
      if (count === 0) return;
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureCode: payment.failureCode ?? 'EXPIRED',
          failureReason: payment.failureReason ?? 'The payment window expired before payment was completed',
        },
      });
      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.PAYMENT_FAILED,
          partitionKey: payment.orderId,
          correlationId: `expire-${payment.id}`,
          payload: this.toEventPayload(updated),
        }),
      });
    });
    this.logger.log(`payment ${payment.id} expired unpaid`);
  }

  /** Webhook entry point: find our payment for a gateway payment and apply it. */
  async applyFromWebhook(gateway: PaymentGateway, gatewayPayment: GatewayPayment, ctx: RequestContext): Promise<void> {
    const payment = gatewayPayment.gatewayOrderId
      ? await this.prisma.payment.findUnique({ where: { gatewayOrderId: gatewayPayment.gatewayOrderId } })
      : await this.prisma.payment.findUnique({ where: { gatewayPaymentId: gatewayPayment.gatewayPaymentId } });
    if (!payment || payment.gateway !== gateway) {
      // Usually a dashboard test payment - log and move on rather than failing the webhook forever.
      this.logger.warn(`webhook for unknown ${gateway} order ${gatewayPayment.gatewayOrderId}`);
      return;
    }
    await this.applyGatewayState(payment.id, gatewayPayment, null, ctx);
  }

  async getById(paymentId: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, attempts: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!payment || (userId && payment.userId !== userId)) throw AppException.notFound('Payment', paymentId);
    return payment;
  }

  async listForUser(userId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderId: true,
          orderNumber: true,
          gateway: true,
          status: true,
          method: true,
          amount: true,
          refundedAmount: true,
          currency: true,
          capturedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Reconciliation - every payment eventually reaches a terminal state even if the
   * webhook was lost and the client never came back:
   *  1. known gateway payment stuck PENDING/AUTHORIZED -> re-fetch it;
   *  2. no gateway payment known yet (customer paid, then closed the tab) -> ask the
   *     gateway for every attempt on our gateway order and apply the best outcome;
   *  3. checkout window closed with nothing captured -> FAILED + payment.failed, which
   *     the order saga turns into a cancellation that releases the stock.
   */
  async reconcileStale(olderThanMinutes = 5, limit = 100): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stale = await this.prisma.payment.findMany({
      where: {
        gateway: { not: PaymentGateway.COD },
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let touched = 0;
    for (const payment of stale) {
      const ctx = { correlationId: `reconcile-${payment.id}` };
      try {
        const provider = this.providers.forGateway(payment.gateway);
        const observed = await this.observe(provider, payment);
        const expired = Boolean(payment.expiresAt && payment.expiresAt.getTime() < Date.now());
        if (observed && (observed.status !== PaymentStatus.FAILED || !expired)) {
          await this.applyGatewayState(payment.id, observed, null, ctx);
          touched++;
        } else if (expired) {
          // Nothing succeeded inside the window (declined attempts, or never paid).
          await this.expire(payment);
          touched++;
        }
      } catch (error) {
        this.logger.warn(`reconcile ${payment.id} failed: ${(error as Error).message}`);
      }
    }
    return touched;
  }

  private async observe(provider: PaymentProvider, payment: PaymentRow): Promise<GatewayPayment | null> {
    if (payment.gatewayPaymentId) return provider.fetchPayment(payment.gatewayPaymentId);
    if (!payment.gatewayOrderId) return null;
    const attempts = await provider.fetchOrderPayments(payment.gatewayOrderId);
    return (
      attempts.sort((a, b) => (OUTCOME_PRIORITY[b.status] ?? 0) - (OUTCOME_PRIORITY[a.status] ?? 0))[0] ?? null
    );
  }

  // --- views ---------------------------------------------------------------------

  /** What the client needs to open the active gateway's checkout widget. */
  private toCheckoutView(payment: PaymentRow, customer: { name?: string; contact?: string; email?: string | null }) {
    const provider = this.providers.forGateway(payment.gateway);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderNumber: payment.orderNumber,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      expiresAt: payment.expiresAt,
      /** Which client adapter to use: 'razorpay', 'mock', ... */
      provider: provider.name,
      /** Opaque to everything except that adapter. */
      clientConfig: provider.clientCheckout({
        paymentId: payment.id,
        gatewayOrderId: payment.gatewayOrderId as string,
        orderNumber: payment.orderNumber,
        amount: payment.amount,
        currency: payment.currency,
        merchantName: this.merchantName,
        customer,
      }),
    };
  }

  private toStatusView(payment: PaymentRow) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderNumber: payment.orderNumber,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      capturedAmount: payment.capturedAmount,
      capturedAt: payment.capturedAt,
      failureReason: payment.failureReason,
    };
  }

  private toEventPayload(payment: PaymentRow) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      gateway: payment.gateway,
      gatewayOrderId: payment.gatewayOrderId ?? undefined,
      gatewayPaymentId: payment.gatewayPaymentId ?? undefined,
      status: payment.status,
      method: payment.method ?? undefined,
      amount: payment.amount,
      currency: payment.currency,
      failureReason: payment.failureReason ?? undefined,
    };
  }
}
