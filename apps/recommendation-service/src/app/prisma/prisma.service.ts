import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@ecom-db/recommendation';

/**
 * Prisma client for the recommendation database.
 *
 * Each service owns a separate database and therefore a separately generated client.
 * Connecting eagerly in `onModuleInit` means a bad connection string fails the
 * container's startup probe rather than surfacing on the first customer request.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('connected to recommendation database');
  }

  async onModuleDestroy(): Promise<void> {
    // Closes the pool so Postgres reclaims connections immediately on shutdown instead
    // of waiting for them to time out during a rolling deploy.
    await this.$disconnect();
  }
}
