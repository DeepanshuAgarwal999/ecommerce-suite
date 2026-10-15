/**
 * Dev-only harness: feeds synthetic confirmed orders through recommendation-service's
 * real purchase-learning code (LearnConsumer.onOrderConfirmed -> IngestService) and
 * runs one model build, WITHOUT publishing to Kafka - so catalog-service's own
 * ORDER_CONFIRMED consumer (sold counts) is never touched.
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only \
 *     apps/recommendation-service/src/testing/simulate-purchases.ts <scenario.json>
 *
 * scenario.json: { "orders": [{ "userId": "...", "productIds": ["..."], "daysAgo": 0 }] }
 * Never run against production data.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { RedisService } from '@ecommerce/redis';
import { FatigueService } from '../app/engine/fatigue.service';
import { IngestService } from '../app/engine/ingest.service';
import { LearnConsumer } from '../app/learning/learn.consumer';
import { ModelBuilderService } from '../app/learning/model-builder.service';
import { PrismaService } from '../app/prisma/prisma.service';

interface Scenario {
  orders: { userId: string; productIds: string[]; daysAgo?: number }[];
}

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Scenario;
  const prisma = new PrismaService();
  await prisma.$connect();
  const redis = new RedisService(
    new Redis({ host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) }),
  );
  const fatigue = new FatigueService(prisma);
  const ingest = new IngestService(prisma, redis, fatigue);
  // Kafka consumer + idempotency are not needed: we call the handler directly.
  const learn = new LearnConsumer(null as never, prisma, ingest, null as never, redis);
  const builder = new ModelBuilderService(prisma, fatigue, redis);

  // Oldest first, so "bought later" pairs see the earlier purchase.
  const orders = [...scenario.orders].sort((a, b) => (b.daysAgo ?? 0) - (a.daysAgo ?? 0));
  for (const order of orders) {
    const occurredAt = new Date(Date.now() - (order.daysAgo ?? 0) * 86_400_000).toISOString();
    await (learn as unknown as { onOrderConfirmed: (e: unknown) => Promise<void> }).onOrderConfirmed({
      eventId: randomUUID(),
      occurredAt,
      payload: {
        orderId: randomUUID(),
        userId: order.userId,
        lines: order.productIds.map((productId) => ({ productId, quantity: 1 })),
      },
    });
  }
  console.log(`applied ${orders.length} synthetic orders`);

  await ingest.flush();
  await builder.build();
  const neighbors = await prisma.itemNeighbor.groupBy({ by: ['kind'], _count: true });
  console.log('neighbours after build:', JSON.stringify(neighbors));

  await ingest.onModuleDestroy();
  await fatigue.onModuleDestroy();
  await redis.client.quit();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
