import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException, ErrorCode } from '@ecommerce/common';
import {
  buildPaginationMeta,
  KafkaTopics,
  PaymentGateway,
  PaymentStatus,
  RefundStatus,
  RequestContext,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { Prisma } from '@ecom-db/payment';
import { PrismaService } from '../prisma/prisma.service';
import type { GatewayRefund } from '../providers/payment-provider';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';

export interface RefundInput {
  paymentId?: string;
  orderId: string;
  amount: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  instant?: boolean;
}

/**
 * Refunds.
 *
 * A refund is money leaving the platform, so the guards are strict:
 *
 *  - the total refunded can never exceed the amount captured, enforced with a
 *    conditional update rather than a check-then-act;
 *  - every request carries an idempotency key, and the unique index on it means a
 *    retried cancellation cannot pay out twice;
 *  - the gateway call happens *after* the local row is committed as PENDING, so a crash
 *    between the two leaves a visible pending refund to reconcile, not a silent double.
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async create(input: RefundInput, ctx: RequestContext) {
    const idempotencyKey =
      input.idempotencyKey ??
      (input.referenceType && input.referenceId
        ? `${input.referenceType}:${input.referenceId}`
        : undefined);

    if (idempotencyKey) {
      const replay = await this.prisma.refund.findUnique({ where: { idempotencyKey } });
      if (replay) return replay;
    }

    const payment = input.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: input.paymentId } })
      : await this.prisma.payment.findFirst({
          where: { orderId: input.orderId, status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED] } },
          orderBy: { capturedAt: 'desc' },
        });

    if (!payment) throw AppException.notFound('Captured payment for order', input.orderId);

    if (payment.gateway === PaymentGateway.COD) {
      // Nothing was collected online; a COD "refund" is a manual bank transfer handled
      // outside the gateway. Record it so the ledger balances, but skip the gateway.
      return this.recordManualRefund(payment.id, input, idempotencyKey, ctx);
    }

    const refundable: PaymentStatus[] = [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED];
    if (!refundable.includes(payment.status)) {
      throw new AppException(
        ErrorCode.REFUND_NOT_ALLOWED,
        `A ${payment.status} payment cannot be refunded`,
        HttpStatus.CONFLICT,
      );
    }

    const amount = Math.round(input.amount);
    if (amount <= 0) throw AppException.validation('Refund amount must be positive');

    // Reserve the amount against the payment atomically. The predicate is the guard.
    let refund;
    try {
      refund = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({
          where: {
            id: payment.id,
            refundedAmount: { lte: payment.capturedAmount - amount },
          },
          data: {
            refundedAmount: { increment: amount },
            status: PaymentStatus.REFUND_PENDING,
          },
        });

        if (count === 0) {
          throw new AppException(
            ErrorCode.REFUND_NOT_ALLOWED,
            'Refund amount exceeds what can still be refunded on this payment',
            HttpStatus.CONFLICT,
          );
        }

        return tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            amount,
            currency: payment.currency,
            status: RefundStatus.PENDING,
            speed: input.instant ? 'optimum' : 'normal',
            reason: input.reason,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            idempotencyKey,
            initiatedBy: ctx.userId,
          },
        });
      });
    } catch (error) {
      // Same idempotency key raced (retried cancellation, two consumers): the unique
      // index stopped the second insert and rolled back its reservation. Return the
      // refund the first one created instead of an error.
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.refund.findUnique({ where: { idempotencyKey } });
        if (winner) return winner;
      }
      throw error;
    }

    // Gateway call outside the transaction: a network hang must not hold a DB lock.
    try {
      // Refunded through the gateway that took the payment, whatever is active today.
      const gatewayRefund = await this.providers.forGateway(payment.gateway).refund({
        gatewayPaymentId: payment.gatewayPaymentId as string,
        amount,
        receipt: refund.id,
        notes: { orderId: payment.orderId, reason: input.reason ?? '' },
        instant: input.instant,
      });

      return await this.applyGatewayState(gatewayRefund, ctx, refund.id);
    } catch (error) {
      // Undo the reservation so the amount is refundable again after the gateway issue
      // is resolved. The refund row stays as FAILED for the audit trail.
      await this.prisma.$transaction([
        this.prisma.refund.update({
          where: { id: refund.id },
          data: { status: RefundStatus.FAILED, failureReason: (error as Error).message.slice(0, 500) },
        }),
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: { decrement: amount },
            status: payment.status,
          },
        }),
      ]);
      throw error;
    }
  }

  /**
   * Applies a gateway refund (already normalised by its adapter), from either the API
   * response or a webhook. Idempotent on `gatewayRefundId`.
   */
  async applyGatewayState(gatewayRefund: GatewayRefund, ctx: RequestContext, localId?: string) {
    const refund = localId
      ? await this.prisma.refund.findUnique({ where: { id: localId } })
      : await this.prisma.refund.findUnique({ where: { gatewayRefundId: gatewayRefund.gatewayRefundId } });

    if (!refund) {
      this.logger.warn(`refund webhook for unknown gateway refund ${gatewayRefund.gatewayRefundId}`);
      return null;
    }

    const nextStatus: RefundStatus = gatewayRefund.status;

    if (refund.status === nextStatus && refund.gatewayRefundId) return refund;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.refund.update({
        where: { id: refund.id },
        data: {
          gatewayRefundId: gatewayRefund.gatewayRefundId,
          status: nextStatus,
          processedAt: nextStatus === RefundStatus.PROCESSED ? new Date() : undefined,
        },
      });

      const payment = await tx.payment.findUniqueOrThrow({ where: { id: refund.paymentId } });

      if (nextStatus === RefundStatus.PROCESSED) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status:
              payment.refundedAmount >= payment.capturedAmount
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED,
          },
        });

        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.REFUND_PROCESSED,
            partitionKey: refund.orderId,
            correlationId: ctx.correlationId,
            actorId: ctx.userId,
            payload: {
              refundId: refund.id,
              paymentId: refund.paymentId,
              orderId: refund.orderId,
              userId: refund.userId,
              amount: refund.amount,
              currency: refund.currency,
              status: nextStatus,
              reason: refund.reason ?? undefined,
              gatewayRefundId: gatewayRefund.gatewayRefundId,
            },
          }),
        });
      } else if (nextStatus === RefundStatus.FAILED) {
        // Release the reserved amount so it can be retried.
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: { decrement: refund.amount },
            status:
              payment.refundedAmount - refund.amount > 0
                ? PaymentStatus.PARTIALLY_REFUNDED
                : PaymentStatus.CAPTURED,
          },
        });
      }

      this.logger.log(`refund ${refund.id} -> ${nextStatus}`);
      return updated;
    });
  }

  async list(query: { orderId?: string; userId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const where: Prisma.RefundWhereInput = {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  private async recordManualRefund(
    paymentId: string,
    input: RefundInput,
    idempotencyKey: string | undefined,
    ctx: RequestContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId,
          orderId: input.orderId,
          userId: ctx.userId ?? '',
          amount: Math.round(input.amount),
          status: RefundStatus.PROCESSED,
          speed: 'manual',
          reason: input.reason,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey,
          initiatedBy: ctx.userId,
          processedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.REFUND_PROCESSED,
          partitionKey: input.orderId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            refundId: refund.id,
            paymentId,
            orderId: input.orderId,
            userId: refund.userId,
            amount: refund.amount,
            currency: refund.currency,
            status: RefundStatus.PROCESSED,
            reason: input.reason,
          },
        }),
      });

      return refund;
    });
  }
}
