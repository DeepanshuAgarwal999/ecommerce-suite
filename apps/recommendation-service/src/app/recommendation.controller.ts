import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { RecommendationPatterns } from '@ecommerce/contracts';
import { FatigueService } from './engine/fatigue.service';
import { IdentityService, type Actor } from './engine/identity.service';
import { IngestService } from './engine/ingest.service';
import { ProductActivityService } from './serving/product-activity.service';
import { RecommendationService } from './serving/recommendation.service';

/** What the gateway emits for each storefront activity beacon. */
interface ActivityMessage extends Actor {
  type: 'view' | 'cart' | 'wishlist' | 'impression';
  productId?: string;
  productIds?: string[];
  at?: string;
}

const KIND = { view: 'VIEW', cart: 'CART', wishlist: 'WISHLIST' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class RecommendationController {
  private readonly logger = new Logger(RecommendationController.name);

  constructor(
    private readonly identity: IdentityService,
    private readonly ingest: IngestService,
    private readonly fatigue: FatigueService,
    private readonly recs: RecommendationService,
    private readonly productActivityService: ProductActivityService,
  ) {}

  /**
   * Fire-and-forget (EventPattern - the gateway does not wait for a reply). Only
   * enqueues; IngestService writes in batches. Never throws back to the caller.
   */
  @EventPattern(RecommendationPatterns.ACTIVITY)
  async activity(@Payload() msg: ActivityMessage): Promise<void> {
    try {
      const userKey = this.identity.keyFor(msg);
      if (!userKey) return;
      void this.identity.stitch(msg).catch(() => undefined);

      if (msg.type === 'impression') {
        const ids = (msg.productIds ?? []).filter((id) => UUID.test(id)).slice(0, 48);
        if (ids.length) this.fatigue.recordImpressions(userKey, ids);
        return;
      }
      if (!msg.productId || !UUID.test(msg.productId) || !(msg.type in KIND)) return;
      this.ingest.enqueue({
        userKey,
        productId: msg.productId,
        kind: KIND[msg.type],
        at: msg.at ? new Date(msg.at) : new Date(),
      });
    } catch (error) {
      this.logger.warn(`activity dropped: ${(error as Error).message}`);
    }
  }

  @MessagePattern(RecommendationPatterns.FOR_PRODUCT)
  forProduct(@Payload() msg: Actor & { productId: string }) {
    return this.recs.forProduct(msg.productId, this.identity.keyFor(msg));
  }

  @MessagePattern(RecommendationPatterns.FOR_CART)
  forCart(@Payload() msg: Actor & { productIds: string[] }) {
    return this.recs.forCart(msg.productIds ?? [], this.identity.keyFor(msg));
  }

  @MessagePattern(RecommendationPatterns.PRODUCT_ACTIVITY)
  productActivity(@Payload() msg: { productId: string; months: number }) {
    return this.productActivityService.forProduct(msg.productId, msg.months);
  }

  @MessagePattern(RecommendationPatterns.FOR_USER)
  forUser(@Payload() msg: Actor) {
    return this.recs.forUser(this.identity.keyFor(msg));
  }
}
