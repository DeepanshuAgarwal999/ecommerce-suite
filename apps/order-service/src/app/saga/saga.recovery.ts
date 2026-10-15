import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LockService } from '@ecommerce/redis';
import { CheckoutSaga } from './checkout.saga';

/**
 * Drives stalled sagas to a terminal state.
 *
 * Runs under a lock so one instance sweeps at a time. The cadence is a trade-off: too
 * frequent and it competes with live checkouts for the same rows; too rare and stock
 * stays held longer than it should after a crash. Every two minutes keeps recovery
 * well inside the reservation hold window.
 */
@Injectable()
export class SagaRecoveryJob {
  private readonly logger = new Logger(SagaRecoveryJob.name);

  constructor(
    private readonly saga: CheckoutSaga,
    private readonly locks: LockService,
  ) {}

  @Cron('*/2 * * * *')
  async run(): Promise<void> {
    await this.locks.withLock(
      'lock:order:saga-recovery',
      async () => {
        const recovered = await this.saga.recoverStalled();
        if (recovered > 0) this.logger.warn(`recovered ${recovered} stalled checkout sagas`);
      },
      { ttlSeconds: 110 },
    );
  }
}
