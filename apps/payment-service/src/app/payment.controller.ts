import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentPatterns, RequestContext } from '@ecommerce/contracts';
import { CreateRefundDto, VerifyCheckoutDto } from '@ecommerce/contracts';
import { PaymentService } from './payment/payment.service';
import { RefundService } from './refund/refund.service';
import { WebhookService } from './webhook/webhook.service';

/** Pattern for the gateway to forward Razorpay webhooks. Kept off the public contract
 *  list because only the gateway's webhook route should ever send it. */
export const WEBHOOK_PATTERN = 'payment.webhook.razorpay';

@Controller()
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
    private readonly webhooks: WebhookService,
  ) {}

  @MessagePattern(PaymentPatterns.CREATE_CHECKOUT)
  createCheckout(
    @Payload()
    msg: { userId: string; orderId: string; idempotencyKey?: string; ctx: RequestContext },
  ) {
    return this.payments.createCheckout(msg.userId, msg.orderId, msg.idempotencyKey, msg.ctx);
  }

  @MessagePattern(PaymentPatterns.VERIFY_SIGNATURE)
  verify(@Payload() msg: { userId: string; dto: VerifyCheckoutDto; ctx: RequestContext }) {
    return this.payments.verifyCheckout(msg.userId, msg.dto, msg.ctx);
  }

  @MessagePattern(PaymentPatterns.GET_PAYMENT)
  get(@Payload() msg: { paymentId: string; userId?: string }) {
    return this.payments.getById(msg.paymentId, msg.userId);
  }

  @MessagePattern(PaymentPatterns.LIST_MY_PAYMENTS)
  listMine(@Payload() msg: { userId: string; page?: number; limit?: number }) {
    return this.payments.listForUser(msg.userId, msg);
  }

  @MessagePattern(PaymentPatterns.REFUND)
  refund(@Payload() msg: { dto: CreateRefundDto; ctx: RequestContext }) {
    return this.refunds.create(
      {
        orderId: msg.dto.orderId,
        paymentId: msg.dto.paymentId,
        amount: msg.dto.amount,
        reason: msg.dto.reason,
        instant: msg.dto.instant,
        referenceType: 'MANUAL',
        referenceId: `${msg.dto.orderId}:${msg.ctx.correlationId}`,
      },
      msg.ctx,
    );
  }

  @MessagePattern(PaymentPatterns.LIST_REFUNDS)
  listRefunds(
    @Payload() msg: { orderId?: string; userId?: string; page?: number; limit?: number },
  ) {
    return this.refunds.list(msg);
  }

  @MessagePattern(WEBHOOK_PATTERN)
  webhook(@Payload() msg: { rawBody: string; signature: string; eventId: string }) {
    return this.webhooks.ingest(msg);
  }
}
