import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@ecom-db/payment';
import { PaymentService } from '../payment/payment.service';
import type { PaymentProvider } from '../providers/payment-provider';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { PrismaService } from '../prisma/prisma.service';
import { RefundService } from '../refund/refund.service';

/**
 * Webhook intake for every gateway (/payments/webhooks/:provider).
 *
 * Three properties, each one line below, none of them gateway-specific:
 *  - Verified: the gateway's adapter checks the signature over the raw bytes first.
 *  - Durable: the event is stored before it is processed, so a crash loses nothing.
 *  - Idempotent: (gateway, eventId) is unique, so a redelivery is an insert conflict.
 *
 * Gateways want a fast 2xx, so we store, acknowledge and process from the stored row;
 * processing failures are retried from our table (retryFailed), not by the gateway.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
  ) {}

  async ingest(input: {
    provider: string;
    rawBody: string;
    headers: Record<string, string | undefined>;
  }): Promise<{ accepted: boolean; duplicate: boolean }> {
    const provider = this.providers.byName(input.provider);
    if (!provider) {
      this.logger.warn(`webhook for unknown gateway "${input.provider}"`);
      return { accepted: false, duplicate: false };
    }

    const verified = provider.verifyWebhook({ rawBody: input.rawBody, headers: input.headers });
    if (verified.body === null) {
      this.logger.warn(`${provider.name} webhook body is not JSON`);
      return { accepted: false, duplicate: false };
    }

    let record: Prisma.WebhookEventGetPayload<object>;
    try {
      record = await this.prisma.webhookEvent.create({
        data: {
          gateway: provider.gateway,
          gatewayEventId: verified.eventId,
          eventType: verified.eventType,
          rawPayload: verified.body as never,
          signature: verified.signature.slice(0, 256),
          signatureValid: verified.valid,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    if (!verified.valid) {
      // Stored for forensics, never acted on: a forged "captured" webhook would be free goods.
      this.logger.error(`${provider.name} webhook ${verified.eventId} failed signature verification`);
      return { accepted: false, duplicate: false };
    }

    await this.process(record.id, provider, verified.body);
    return { accepted: true, duplicate: false };
  }

  /** Processes one stored webhook. Also used by the retry sweep. */
  async process(recordId: string, provider: PaymentProvider, body: unknown): Promise<void> {
    try {
      const action = provider.interpretWebhook(body);
      const ctx = { correlationId: `webhook-${provider.name}-${recordId}` };
      if (action.kind === 'payment') {
        await this.payments.applyFromWebhook(provider.gateway, action.payment, ctx);
      } else if (action.kind === 'refund') {
        await this.refunds.applyGatewayState(action.refund, ctx);
      } else {
        this.logger.debug(`${provider.name} webhook ignored: ${action.reason}`);
      }
      await this.prisma.webhookEvent.update({
        where: { id: recordId },
        data: { processed: true, processedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: recordId },
        data: { attempts: { increment: 1 }, processingError: (error as Error).message.slice(0, 500) },
      });
      throw error;
    }
  }

  /** Re-drives stored, verified webhooks that failed processing, with a bounded attempt count. */
  async retryFailed(limit = 50, maxAttempts = 5): Promise<number> {
    const pending = await this.prisma.webhookEvent.findMany({
      where: { processed: false, signatureValid: true, attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let ok = 0;
    for (const record of pending) {
      try {
        await this.process(record.id, this.providers.forGateway(record.gateway), record.rawPayload);
        ok++;
      } catch (error) {
        this.logger.warn(`webhook retry ${record.id} failed: ${(error as Error).message}`);
      }
    }
    return ok;
  }
}
