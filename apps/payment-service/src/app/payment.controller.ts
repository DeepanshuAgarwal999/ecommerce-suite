import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentPatterns, RequestContext } from '@ecommerce/contracts';
import { ConfirmPaymentDto, CreateRefundDto } from '@ecommerce/contracts';
import { PaymentService } from './payment/payment.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { RefundService } from './refund/refund.service';
import { WebhookService } from './webhook/webhook.service';

@Controller()
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
    private readonly webhooks: WebhookService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  @MessagePattern(PaymentPatterns.ACTIVE_PROVIDER)
  activeProvider() {
    return { provider: this.providers.active().name };
  }

  @MessagePattern(PaymentPatterns.CREATE_CHECKOUT)
  createCheckout(
    @Payload()
    msg: { userId: string; orderId: string; idempotencyKey?: string; ctx: RequestContext },
  ) {
    return this.payments.createCheckout(msg.userId, msg.orderId, msg.idempotencyKey, msg.ctx);
  }

  @MessagePattern(PaymentPatterns.CONFIRM)
  confirm(@Payload() msg: { userId: string; dto: ConfirmPaymentDto; ctx: RequestContext }) {
    return this.payments.confirm(msg.userId, msg.dto, msg.ctx);
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

  /** Any gateway's webhook, forwarded raw by api-gateway's /payments/webhooks/:provider. */
  @MessagePattern(PaymentPatterns.WEBHOOK)
  webhook(@Payload() msg: { provider: string; rawBody: string; headers: Record<string, string | undefined> }) {
    return this.webhooks.ingest(msg);
  }
}
