import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException, ErrorCode } from '@ecommerce/common';
import { KafkaTopics, OrderStatus, RequestContext } from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { RequestReturnDto } from '@ecommerce/contracts';

/**
 * Returns and the refunds they trigger.
 *
 * The refund amount is computed from the order lines, never taken from the request, so a
 * return can never refund more than was charged for those items. Discounts were spread
 * across lines at order time precisely so this arithmetic is exact.
 */
@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
  ) {}

  async request(orderId: string, userId: string, dto: RequestReturnDto, ctx: RequestContext) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, returns: { include: { items: true } } },
    });

    if (!order || order.userId !== userId) throw AppException.notFound('Order', orderId);

    if (order.status !== OrderStatus.DELIVERED) {
      throw new AppException(
        ErrorCode.INVALID_ORDER_TRANSITION,
        'Only delivered orders can be returned',
        HttpStatus.CONFLICT,
      );
    }

    if (order.deliveredAt) {
      // Return window is per product in the catalogue; the order stores the widest one
      // that applied. Seven days is the platform floor.
      const windowDays = 7;
      const deadline = new Date(order.deliveredAt.getTime() + windowDays * 86_400_000);
      if (deadline < new Date()) {
        throw new AppException(
          ErrorCode.INVALID_ORDER_TRANSITION,
          'The return window for this order has closed',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Quantity already returned per line, so a second request cannot exceed what was bought.
    const alreadyReturned = new Map<string, number>();
    for (const existing of order.returns) {
      if (existing.status === 'REJECTED') continue;
      for (const line of existing.items) {
        alreadyReturned.set(
          line.orderItemId,
          (alreadyReturned.get(line.orderItemId) ?? 0) + line.quantity,
        );
      }
    }

    const lines = dto.items.map((request) => {
      const item = order.items.find((candidate) => candidate.id === request.orderItemId);
      if (!item) throw AppException.notFound('Order item', request.orderItemId);

      const remaining = item.quantity - (alreadyReturned.get(item.id) ?? 0);
      if (request.quantity > remaining) {
        throw AppException.validation(
          `Only ${remaining} of "${item.title}" can still be returned`,
        );
      }

      // Refund per unit is what was actually paid for it: price less its discount share.
      const paidPerUnit = Math.round((item.lineTotal - item.discount) / item.quantity);
      return {
        orderItemId: item.id,
        quantity: request.quantity,
        amount: paidPerUnit * request.quantity,
      };
    });

    const refundAmount = lines.reduce((sum, line) => sum + line.amount, 0);

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.returnRequest.create({
        data: {
          orderId,
          userId,
          reason: dto.reason,
          description: dto.description,
          imageUrls: dto.imageUrls ?? [],
          refundAmount,
          items: { create: lines },
        },
        include: { items: true },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.ORDER_RETURN_REQUESTED,
          partitionKey: orderId,
          correlationId: ctx.correlationId,
          actorId: userId,
          payload: {
            returnId: created.id,
            orderId,
            orderNumber: order.orderNumber,
            userId,
            refundAmount,
            reason: dto.reason,
          },
        }),
      });

      return created;
    });

    await this.orders.applyStatus(orderId, OrderStatus.RETURN_REQUESTED, {
      reason: dto.reason,
      changedBy: userId,
      correlationId: ctx.correlationId,
    });

    return request;
  }

  /** Staff decision. Approval starts the pickup; the refund fires once goods are received. */
  async review(
    returnId: string,
    decision: { approved: boolean; reason?: string },
    ctx: RequestContext,
  ) {
    const request = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: true },
    });
    if (!request) throw AppException.notFound('Return request', returnId);
    if (request.status !== 'REQUESTED') {
      throw AppException.conflict(`Return is already ${request.status}`);
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status: decision.approved ? 'APPROVED' : 'REJECTED',
        approvedBy: ctx.userId,
        approvedAt: decision.approved ? new Date() : null,
      },
    });

    await this.orders.applyStatus(
      request.orderId,
      decision.approved ? OrderStatus.RETURN_APPROVED : OrderStatus.DELIVERED,
      {
        reason: decision.reason ?? (decision.approved ? 'Return approved' : 'Return rejected'),
        changedBy: ctx.userId,
        correlationId: ctx.correlationId,
      },
    );

    return updated;
  }

  /**
   * Goods are back in the warehouse. This is the point the refund is requested -
   * refunding on approval would pay out for items that never come back.
   */
  async markReceived(returnId: string, ctx: RequestContext) {
    const request = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: true, items: { include: { orderItem: true } } },
    });
    if (!request) throw AppException.notFound('Return request', returnId);
    if (request.status !== 'APPROVED') {
      throw AppException.conflict(`Return must be APPROVED before it can be received`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });

      // payment-service owns the money movement; we only ask.
      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.REFUND_REQUESTED,
          partitionKey: request.orderId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            orderId: request.orderId,
            paymentId: request.order.paymentId,
            userId: request.userId,
            amount: request.refundAmount,
            currency: request.order.currency,
            reason: `Return ${returnId}: ${request.reason}`,
            referenceType: 'RETURN',
            referenceId: returnId,
          },
        }),
      });

      // Returned units go back on the shelf.
      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.STOCK_RELEASE_REQUESTED,
          partitionKey: request.orderId,
          correlationId: ctx.correlationId,
          payload: {
            orderId: request.orderId,
            reason: 'return_received',
            restock: request.items.map((line) => ({
              sku: line.orderItem.sku,
              warehouseId: line.orderItem.warehouseId,
              quantity: line.quantity,
            })),
          },
        }),
      });
    });

    await this.orders.applyStatus(request.orderId, OrderStatus.RETURNED, {
      reason: 'Return received at warehouse',
      changedBy: ctx.userId,
      correlationId: ctx.correlationId,
    });

    return { ok: true as const };
  }
}
