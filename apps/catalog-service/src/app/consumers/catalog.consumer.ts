import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  OrderCreatedPayload,
  VendorLifecyclePayload,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';

/**
 * Keeps catalogue projections in step with the rest of the platform.
 *
 * `soldCount` is updated from order events rather than queried from order-service. It
 * drives the default "popular" sort, so it has to be readable in the same query as the
 * product - a cross-service join on the hottest listing path is not an option.
 */
@Injectable()
export class CatalogConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly products: ProductService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.CATALOG_PROJECTION,
        topics: [KafkaTopics.ORDER_CONFIRMED, KafkaTopics.VENDOR_APPROVED],
      },
      {
        [KafkaTopics.ORDER_CONFIRMED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onOrderConfirmed(envelope as EventEnvelope<OrderCreatedPayload>),
          ),
        [KafkaTopics.VENDOR_APPROVED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onVendorApproved(envelope as EventEnvelope<VendorLifecyclePayload>),
          ),
      },
    );
  }

  /** Bumps the popularity counter for every product in a confirmed order. */
  private async onOrderConfirmed(envelope: EventEnvelope<OrderCreatedPayload>): Promise<void> {
    const lines = envelope.payload.lines ?? [];
    if (lines.length === 0) return;

    // Collapse duplicate products in one order into a single increment.
    const quantities = new Map<string, number>();
    for (const line of lines) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    }

    await this.prisma.$transaction(
      [...quantities].map(([productId, quantity]) =>
        this.prisma.product.updateMany({
          where: { id: productId },
          data: { soldCount: { increment: quantity } },
        }),
      ),
    );
  }

  private async onVendorApproved(envelope: EventEnvelope<VendorLifecyclePayload>): Promise<void> {
    const { vendorId, businessName } = envelope.payload;
    await this.products.syncVendorName(vendorId, businessName);
  }

  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.CATALOG_PROJECTION;
    if (!(await this.idempotency.markEventProcessed(group, envelope.eventId))) {
      this.logger.debug(`skipping duplicate event ${envelope.eventId}`);
      return;
    }

    const applied = await this.prisma.processedEvent.findUnique({
      where: { eventId: envelope.eventId },
      select: { eventId: true },
    });
    if (applied) return;

    try {
      await handler();
      await this.prisma.processedEvent.create({
        data: { eventId: envelope.eventId, consumerGroup: group },
      });
    } catch (error) {
      // Let the retry / redelivery actually re-run it (see IdempotencyService.releaseEvent).
      await this.idempotency.releaseEvent(group, envelope.eventId);
      throw error;
    }
  }
}
