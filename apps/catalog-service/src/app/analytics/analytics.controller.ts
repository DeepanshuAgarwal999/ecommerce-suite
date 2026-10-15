import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CatalogPatterns } from '@ecommerce/contracts';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @MessagePattern(CatalogPatterns.TRACK_PRODUCT_VIEW)
  trackView(@Payload() msg: { productId: string }) {
    return this.analytics.trackView(msg.productId);
  }

  @MessagePattern(CatalogPatterns.TRACK_SEARCH)
  trackSearch(@Payload() msg: { q: string; results: number }) {
    return this.analytics.trackSearch(msg.q, msg.results);
  }

  @MessagePattern(CatalogPatterns.ADMIN_ENGAGEMENT_INSIGHTS)
  engagement(@Payload() msg: { days: number }) {
    return this.analytics.engagement(msg.days);
  }
}
