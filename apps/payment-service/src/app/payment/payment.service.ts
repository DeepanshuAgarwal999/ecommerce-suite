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
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayClient, RazorpayPayment } from '../razorpay/razorpay.client';

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
}

/**
 * Payment lifecycle.
 *
 * The design principle: the client's word is never final. A mobile app can say "the
 * payment succeeded", and we verify its signature and show a success screen - but the
 * order does not ship until Razorpay's webhook says so, server to server. That closes
 * the gap where a tampered client reports a payment that never happened.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly rpcTimeout: number;
  private readonly currency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly config: ConfigService,
    @Inject(ServiceTokens.ORDER) private readonly orders: ClientProxy,
  ) {
    this.rpcTimeout = config.get<number>('observability.rpcTimeoutMs', 10_000);
    this.currency = config.get<string>('razorpay.currency', 'INR');
  }

  /**
   * Starts a payment for an order.
   *
   * Returns what the mobile SDK needs to open the Razorpay sheet. The amount comes from
   * order-service, not from the client - a request body that says "charge me ₹1" is
   * ignored in favour of what the order actually totals.
   */
  async createCheckout(
    userId: string,
    orderId: string,
    idempotencyKey: string | undefined,
    ctx: RequestContext,
  ) {
    if (idempotencyKey) {
      const replay = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (replay) return this.toCheckoutView(replay);
    }

    const order = await rpc<OrderView>(
      this.orders,
      OrderPatterns.GET_ORDER,
      { orderId, userId },
      { timeoutMs: this.rpcTimeout, service: 'order-service' },
    );

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

    // Reuse a live attempt rather than opening a second Razorpay order for the same
    // purchase - two open orders is how a customer ends up charged twice.
    const live = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (live) return this.toCheckoutView(live);

    const gatewayOrder = await this.razorpay.createOrder({
      amountPaise: order.grandTotal,
      currency: order.currency || this.currency,
      receipt: order.orderNumber,
      notes: { orderId, userId },
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          orderNumber: order.orderNumber,
          userId,
          gateway: PaymentGateway.RAZORPAY,
          status: PaymentStatus.CREATED,
          amount: order.grandTotal,
          currency: order.currency || this.currency,
          gatewayOrderId: gatewayOrder.id,
          idempotencyKey,
          // Razorpay orders stay payable for a while, but the stock hold does not.
          expiresAt: new Date(Date.now() + 15 * 60_000),
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

    this.logger.log(`checkout ${payment.id} opened for order ${order.orderNumber}`);
    return this.toCheckoutView(payment);
  }

  /**
   * Handles the client's post-checkout callback.
   *
   * On a valid signature the payment is marked AUTHORIZED - not CAPTURED. Capture is
   * confirmed by the webhook or by fetching the payment from Razorpay, never by trusting
   * the app. If the webhook has already landed, this is a no-op that returns the current
   * state.
   */
  async verifyCheckout(
    userId: string,
    input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
    ctx: RequestContext,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId: input.razorpayOrderId },
    });
    if (!payment || payment.userId !== userId) {
      throw AppException.notFound('Payment', input.razorpayOrderId);
    }

    if (payment.status === PaymentStatus.CAPTURED) return this.toStatusView(payment);

    const valid = this.razorpay.verifyCheckoutSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );

    if (!valid) {
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          status: 'SIGNATURE_INVALID',
          gatewayPaymentId: input.razorpayPaymentId,
          errorCode: 'SIGNATURE_MISMATCH',
        },
      });
      throw new AppException(
        ErrorCode.PAYMENT_SIGNATURE_INVALID,
        'Payment verification failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // The signature is genuine, so ask Razorpay for the real state rather than assuming.
    const gatewayPayment = await this.razorpay.fetchPayment(input.razorpayPaymentId);
    return this.toStatusView(
      await this.applyGatewayState(payment.id, gatewayPayment, input.razorpaySignature, ctx),
    );
  }

  /**
   * Applies a Razorpay payment object to our record.
   *
   * Shared by the client callback and the webhook handler, so both paths converge on
   * one state machine. Idempotent: applying the same gateway state twice changes nothing
   * and emits nothing.
   */
  async applyGatewayState(
    paymentId: string,
    gatewayPayment: RazorpayPayment,
    signature: string | null,
    ctx: RequestContext,
  ) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // Amount mismatch is either a bug or an attack; either way the order must not ship.
    if (gatewayPayment.amount !== payment.amount) {
      this.logger.error(
        `amount mismatch on ${paymentId}: expected ${payment.amount}, gateway says ${gatewayPayment.amount}`,
      );
      throw new AppException(
        ErrorCode.PAYMENT_FAILED,
        'Payment amount does not match the order',
        HttpStatus.CONFLICT,
      );
    }

    const nextStatus = this.mapStatus(gatewayPayment.status);
    if (nextStatus === payment.status) return payment;

    // Only move forward. A late "authorized" webhook after "captured" is stale, not a
    // regression.
    const rank: Record<PaymentStatus, number> = {
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
    if (rank[nextStatus] < rank[payment.status]) return payment;

    const method = this.mapMethod(gatewayPayment.method);
    const methodDetails = {
      method: gatewayPayment.method,
      vpa: gatewayPayment.vpa,
      bank: gatewayPayment.bank,
      wallet: gatewayPayment.wallet,
      card: gatewayPayment.card
        ? {
            network: gatewayPayment.card.network,
            last4: gatewayPayment.card.last4,
            type: gatewayPayment.card.type,
            issuer: gatewayPayment.card.issuer,
          }
        : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: nextStatus,
          method,
          gatewayPaymentId: gatewayPayment.id,
          gatewaySignature: signature ?? undefined,
          methodDetails: methodDetails as never,
          capturedAmount: nextStatus === PaymentStatus.CAPTURED ? gatewayPayment.amount : undefined,
          authorizedAt: nextStatus === PaymentStatus.AUTHORIZED ? new Date() : undefined,
          capturedAt: nextStatus === PaymentStatus.CAPTURED ? new Date() : undefined,
          failedAt: nextStatus === PaymentStatus.FAILED ? new Date() : undefined,
          failureCode: gatewayPayment.error_code,
          failureReason: gatewayPayment.error_description,
        },
      });

      await tx.paymentAttempt.create({
        data: {
          paymentId,
          method,
          status: nextStatus,
          gatewayPaymentId: gatewayPayment.id,
          errorCode: gatewayPayment.error_code,
          errorReason: gatewayPayment.error_description,
          rawResponse: gatewayPayment as never,
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

      this.logger.log(`payment ${paymentId} -> ${nextStatus} (${gatewayPayment.id})`);
      return updated;
    });
  }

  async getById(paymentId: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, attempts: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!payment || (userId && payment.userId !== userId)) {
      throw AppException.notFound('Payment', paymentId);
    }
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
   * Reconciliation: re-fetches payments stuck in a non-terminal state.
   *
   * Webhooks are reliable but not guaranteed. A payment left AUTHORIZED or PENDING past
   * its window is looked up directly, so a dropped webhook cannot strand an order.
   */
  async reconcileStale(olderThanMinutes = 10, limit = 100): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stale = await this.prisma.payment.findMany({
      where: {
        gateway: PaymentGateway.RAZORPAY,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
        gatewayPaymentId: { not: null },
        updatedAt: { lt: cutoff },
      },
      take: limit,
    });

    let touched = 0;
    for (const payment of stale) {
      try {
        const gatewayPayment = await this.razorpay.fetchPayment(payment.gatewayPaymentId as string);
        await this.applyGatewayState(payment.id, gatewayPayment, null, {
          correlationId: `reconcile-${payment.id}`,
        });
        touched++;
      } catch (error) {
        this.logger.warn(`reconcile ${payment.id} failed: ${(error as Error).message}`);
      }
    }
    return touched;
  }

  // --- mapping -------------------------------------------------------------

  private mapStatus(status: RazorpayPayment['status']): PaymentStatus {
    switch (status) {
      case 'created':
        return PaymentStatus.PENDING;
      case 'authorized':
        return PaymentStatus.AUTHORIZED;
      case 'captured':
        return PaymentStatus.CAPTURED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'failed':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapMethod(method: string | undefined): PaymentMethod | undefined {
    switch (method) {
      case 'upi':
        return PaymentMethod.UPI;
      case 'card':
        return PaymentMethod.CARD;
      case 'netbanking':
        return PaymentMethod.NETBANKING;
      case 'wallet':
        return PaymentMethod.WALLET;
      case 'emi':
      case 'cardless_emi':
        return PaymentMethod.EMI;
      case 'paylater':
        return PaymentMethod.PAY_LATER;
      default:
        return undefined;
    }
  }

  private toCheckoutView(payment: Prisma.PaymentGetPayload<object>) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      expiresAt: payment.expiresAt,
      // Exactly what the Razorpay Android/iOS SDK's `open()` needs.
      razorpay: {
        keyId: this.razorpay.publicKeyId,
        orderId: payment.gatewayOrderId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'Ecommerce',
        description: `Order ${payment.orderNumber}`,
      },
    };
  }

  private toStatusView(payment: Prisma.PaymentGetPayload<object>) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      capturedAmount: payment.capturedAmount,
      gatewayPaymentId: payment.gatewayPaymentId,
      capturedAt: payment.capturedAt,
      failureReason: payment.failureReason,
    };
  }

  private toEventPayload(payment: Prisma.PaymentGetPayload<object>) {
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
