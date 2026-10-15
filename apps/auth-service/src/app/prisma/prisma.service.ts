import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@ecom-db/auth';

/**
 * Prisma client for the auth database.
 *
 * Each service has one of these bound to its own generated client, because each owns a
 * separate database. Connecting eagerly in `onModuleInit` means a bad connection string
 * fails the container's startup probe instead of surfacing on the first customer request.
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
    this.logger.log('connected to auth database');
  }

  async onModuleDestroy(): Promise<void> {
    // Closes the pool so Postgres reclaims the connections immediately on shutdown,
    // rather than waiting for them to time out during a rolling deploy.
    await this.$disconnect();
  }
}
