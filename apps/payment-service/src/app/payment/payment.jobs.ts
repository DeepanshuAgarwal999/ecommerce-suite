import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LockService } from '@ecommerce/redis';
import { PaymentService } from './payment.service';
import { WebhookService } from '../webhook/webhook.service';

/**
 * Background reconciliation.
 *
 * Webhooks can be delayed or dropped, and a mobile app can be killed between paying and
 * reporting back. These sweeps are what guarantee every payment eventually reaches a
 * terminal state regardless of which callback got lost.
 */
@Injectable()
export class PaymentJobs {
  private readonly logger = new Logger(PaymentJobs.name);

  constructor(
    private readonly payments: PaymentService,
    private readonly webhooks: WebhookService,
    private readonly locks: LockService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile(): Promise<void> {
    await this.locks.withLock(
      'lock:payment:reconcile',
      async () => {
        const touched = await this.payments.reconcileStale();
        if (touched > 0) this.logger.log(`reconciled ${touched} stale payments`);
      },
      { ttlSeconds: 280 },
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryWebhooks(): Promise<void> {
    await this.locks.withLock(
      'lock:payment:webhook-retry',
      async () => {
        const ok = await this.webhooks.retryFailed();
        if (ok > 0) this.logger.log(`re-processed ${ok} webhooks`);
      },
      { ttlSeconds: 55 },
    );
  }
}
