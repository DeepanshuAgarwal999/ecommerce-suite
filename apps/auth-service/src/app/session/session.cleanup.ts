import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LockService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Housekeeping for expired sessions and OTP audit rows.
 *
 * Both tables grow with traffic and neither is read after its window closes. Left alone,
 * `sessions` becomes the largest table in the auth database and slows down the one query
 * that matters - the refresh-token lookup.
 */
@Injectable()
export class SessionCleanupJob {
  private readonly logger = new Logger(SessionCleanupJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: LockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    await this.locks.withLock('lock:auth:session-cleanup', async () => {
      // Keep revoked sessions for a week: refresh-token reuse detection needs the row
      // to still exist to notice the replay.
      const revokedCutoff = new Date(Date.now() - 7 * 86_400_000);

      const [expired, revoked, otps] = await this.prisma.$transaction([
        this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
        this.prisma.session.deleteMany({ where: { revokedAt: { lt: revokedCutoff } } }),
        this.prisma.otpRequest.deleteMany({
          where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
        }),
      ]);

      this.logger.log(
        `cleanup removed ${expired.count} expired sessions, ${revoked.count} revoked sessions, ` +
          `${otps.count} otp records`,
      );
    });
  }
}
