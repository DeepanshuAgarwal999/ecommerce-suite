import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CatalogPatterns, ShippingEstimateDto, ShippingRuleScope, UpdateShippingSettingsDto, UpsertShippingRuleDto } from '@ecommerce/contracts';
import { ShippingService } from './shipping.service';

@Controller()
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @MessagePattern(CatalogPatterns.GET_SHIPPING_SETTINGS)
  settings() {
    return this.shipping.getSettings();
  }

  @MessagePattern(CatalogPatterns.UPDATE_SHIPPING_SETTINGS)
  updateSettings(@Payload() msg: { dto: UpdateShippingSettingsDto; actorId?: string }) {
    return this.shipping.updateSettings(msg.dto, msg.actorId);
  }

  @MessagePattern(CatalogPatterns.LIST_SHIPPING_RULES)
  overview() {
    return this.shipping.adminOverview();
  }

  @MessagePattern(CatalogPatterns.UPSERT_SHIPPING_RULE)
  upsert(@Payload() msg: { scope: ShippingRuleScope; targetId: string; dto: UpsertShippingRuleDto; actorId?: string }) {
    return this.shipping.upsertRule(msg.scope, msg.targetId, msg.dto, msg.actorId);
  }

  @MessagePattern(CatalogPatterns.DELETE_SHIPPING_RULE)
  remove(@Payload() msg: { scope: ShippingRuleScope; targetId: string }) {
    return this.shipping.deleteRule(msg.scope, msg.targetId);
  }

  /** cart-service: price an order. `productId` given alone returns the product-page view. */
  @MessagePattern(CatalogPatterns.RESOLVE_SHIPPING)
  resolve(@Payload() msg: { productIds?: string[]; productId?: string }) {
    if (msg.productId) return this.shipping.forProduct(msg.productId);
    return this.shipping.resolve(msg.productIds ?? []);
  }

  @MessagePattern(CatalogPatterns.ESTIMATE_SHIPPING)
  estimate(@Payload() msg: ShippingEstimateDto) {
    return this.shipping.estimate(msg.lines);
  }
}
