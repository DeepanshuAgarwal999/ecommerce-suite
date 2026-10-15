import { Injectable, Logger } from '@nestjs/common';

/** Minimal surface a Prisma client exposes that the health check needs. */
export interface QueryableClient {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

/**
 * Readiness probe for a service's own database.
 *
 * Each service generates its own Prisma client from its own schema, so there is no
 * single `PrismaClient` type to depend on here. The check only needs `$queryRaw`, so it
 * accepts anything that provides it and stays generic across all nine services.
 */
@Injectable()
export class PrismaHealth {
  private readonly logger = new Logger(PrismaHealth.name);

  constructor(private readonly client: QueryableClient) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(`database health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
