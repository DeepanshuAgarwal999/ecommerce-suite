import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '@ecom-db/recommendation';
import { rpc } from '@ecommerce/common';
import { CatalogPatterns, ServiceTokens } from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';

interface IndexPage {
  items: { id: string; categoryId: string | null; status: string }[];
  hasNext: boolean;
}

/**
 * Full re-sync of the product projection from catalog-service - on boot and every
 * 6 hours. Kafka product events keep it current between syncs; this is the safety
 * net that covers products created before this service existed and any event the
 * projection missed. Paged, so it never holds the catalogue in memory.
 */
@Injectable()
export class CatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ServiceTokens.CATALOG) private readonly catalog: ClientProxy,
  ) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.sync(), 5_000);
  }

  @Interval(6 * 60 * 60 * 1000)
  scheduled(): void {
    void this.sync();
  }

  async sync(): Promise<void> {
    if (this.running) return;
    this.running = true;
    let total = 0;
    try {
      for (let page = 1; page <= 2000; page++) {
        const result = await rpc<IndexPage>(this.catalog, CatalogPatterns.PRODUCT_INDEX, { page, limit: 500 }, {
          timeoutMs: 15_000,
          service: 'catalog-service',
        });
        if (result.items.length) {
          const values = result.items.map(
            (item) => Prisma.sql`(${item.id}::uuid, ${item.categoryId}::uuid, ${item.status}, now())`,
          );
          await this.prisma.$executeRaw`
            INSERT INTO "product_projection" ("id", "categoryId", "status", "updatedAt")
            VALUES ${Prisma.join(values)}
            ON CONFLICT ("id") DO UPDATE SET
              "categoryId" = EXCLUDED."categoryId", "status" = EXCLUDED."status", "updatedAt" = now()`;
          total += result.items.length;
        }
        if (!result.hasNext) break;
      }
      this.logger.log(`product projection synced (${total} products)`);
    } catch (error) {
      this.logger.warn(`catalog sync failed, will retry on schedule: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
