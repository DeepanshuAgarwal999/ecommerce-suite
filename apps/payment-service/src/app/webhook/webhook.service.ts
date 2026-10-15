import { Injectable, Logger } from '@nestjs/common';
import { RazorpayWebhookEvents } from '@ecommerce/contracts';
import { Prisma } from '@ecom-db/payment';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayClient, RazorpayPayment, RazorpayRefund } from '../razorpay/razorpay.client';
import { PaymentService } from '../payment/payment.service';
import { RefundService } from '../refund/refund.service';

interface RazorpayWebhookBody {
  event: string;
  created_at: number;
  payload: {
    payment?: { entity: RazorpayPayment };
    refund?: { entity: RazorpayRefund };
    order?: { entity: { id: string } };
  };
}

/**
 * Razorpay webhook intake.
 *
 * Three properties matter here and each maps to a line of code below:
 *
 *  - Verified: the HMAC is checked against the raw bytes before anything is parsed.
 *  - Durable: the event is written to `WebhookEvent` before it is processed, so a crash
 *    mid-handling loses nothing - the row is retried.
 *  - Idempotent: the unique `gatewayEventId` makes a redelivered webhook an insert
 *    conflict, which we treat as "already handled".
 *
 * Razorpay expects a 2xx quickly; anything slow is retried and anything non-2xx is
 * retried harder. So the handler stores, acknowledges, and does the real work from the
 * stored row.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
  ) {}

  async ingest(input: {
    rawBody: string;
    signature: string;
    eventId: string;
  }): Promise<{ accepted: boolean; duplicate: boolean }> {
    const valid = this.razorpay.verifyWebhookSignature(input.rawBody, input.signature);

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(input.rawBody) as RazorpayWebhookBody;
    } catch {
      this.logger.warn('webhook body is not JSON');
      return { accepted: false, duplicate: false };
    }

    let record: Prisma.WebhookEventGetPayload<object>;
    try {
      record = await this.prisma.webhookEvent.create({
        data: {
          gatewayEventId: input.eventId,
          eventType: body.event,
          rawPayload: body as never,
          signature: input.signature,
          signatureValid: valid,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.debug(`duplicate webhook ${input.eventId}`);
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    if (!valid) {
      // Stored for forensics, never acted on. A forged webhook that could flip a payment
      // to CAPTURED would be a free-goods exploit.
      this.logger.error(`webhook ${input.eventId} failed signature verification`);
      return { accepted: false, duplicate: false };
    }

    await this.process(record.id, body);
    return { accepted: true, duplicate: false };
  }

  /** Processes one stored webhook. Also used by the retry sweep. */
  async process(recordId: string, body: RazorpayWebhookBody): Promise<void> {
    try {
      await this.dispatch(body);
      await this.prisma.webhookEvent.update({
        where: { id: recordId },
        data: { processed: true, processedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: recordId },
        data: {
          attempts: { increment: 1 },
          processingError: (error as Error).message.slice(0, 500),
        },
      });
      throw error;
    }
  }

  /** Re-drives stored webhooks that failed processing, with a bounded attempt count. */
  async retryFailed(limit = 50, maxAttempts = 5): Promise<number> {
    const pending = await this.prisma.webhookEvent.findMany({
      where: { processed: false, signatureValid: true, attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let ok = 0;
    for (const record of pending) {
      try {
        await this.process(record.id, record.rawPayload as unknown as RazorpayWebhookBody);
        ok++;
      } catch (error) {
        this.logger.warn(`webhook retry ${record.id} failed: ${(error as Error).message}`);
      }
    }
    return ok;
  }

  private async dispatch(body: RazorpayWebhookBody): Promise<void> {
    const ctx = { correlationId: `webhook-${body.event}-${body.created_at}` };

    switch (body.event) {
      case RazorpayWebhookEvents.PAYMENT_AUTHORIZED:
      case RazorpayWebhookEvents.PAYMENT_CAPTURED:
      case RazorpayWebhookEvents.PAYMENT_FAILED: {
        const entity = body.payload.payment?.entity;
        if (!entity) return;

        const payment = await this.prisma.payment.findUnique({
          where: { gatewayOrderId: entity.order_id },
        });
        if (!payment) {
          // A payment for an order we never created - usually a dashboard test. Log and
          // move on rather than failing the webhook forever.
          this.logger.warn(`webhook for unknown gateway order ${entity.order_id}`);
          return;
        }

        await this.payments.applyGatewayState(payment.id, entity, null, ctx);
        return;
      }

      case RazorpayWebhookEvents.REFUND_PROCESSED:
      case RazorpayWebhookEvents.REFUND_FAILED: {
        const entity = body.payload.refund?.entity;
        if (!entity) return;
        await this.refunds.applyGatewayState(entity, ctx);
        return;
      }

      case RazorpayWebhookEvents.ORDER_PAID:
      case RazorpayWebhookEvents.REFUND_CREATED:
        // Informational; the payment/refund events above carry the state we act on.
        return;

      default:
        this.logger.debug(`ignoring webhook event ${body.event}`);
    }
  }
}
