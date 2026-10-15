import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationStatus } from '@ecommerce/contracts';
import { LockService } from '@ecommerce/redis';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from './reservation.service';

/**
 * Releases holds that were never paid for.
 *
 * This is the safety net that keeps abandoned checkouts from permanently removing stock
 * from sale. Every reservation carries a deadline; anything past it that is still HELD
 * gets released and its units returned to the pool.
 *
 * Runs frequently and under a lock, so exactly one instance sweeps at a time and stock
 * comes back within about a minute of expiry rather than at the next deploy.
 */
@Injectable()
export class ReservationSweeper {
  private readonly logger = new Logger(ReservationSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationService,
    private readonly locks: LockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    await this.locks.withLock(
      'lock:inventory:reservation-sweep',
      async () => {
        const expired = await this.prisma.reservation.findMany({
          where: { status: ReservationStatus.HELD, expiresAt: { lt: new Date() } },
          select: { orderId: true },
          // Bounded batch: a large backlog is drained over several runs rather than in
          // one long transaction that would hold locks on hot stock rows.
          take: 200,
        });

        if (expired.length === 0) return;

        let released = 0;
        for (const { orderId } of expired) {
          try {
            await this.reservations.release(orderId, 'reservation_expired', randomUUID());
            released++;
          } catch (error) {
            // One bad reservation must not stop the rest of the batch.
            this.logger.error(
              `failed to release expired reservation for order ${orderId}: ` +
                (error as Error).message,
            );
          }
        }

        this.logger.log(`released ${released} expired reservations`);
      },
      { ttlSeconds: 120 },
    );
  }
}
