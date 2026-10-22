import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@ecommerce/auth';
import {
  AuthenticatedUser,
  CatalogPatterns,
  Role,
  ShippingRuleScope,
  UpdateShippingSettingsDto,
  UpsertShippingRuleDto,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

/**
 * Delivery charges console: store settings, category rules (inherited down the
 * tree) and per-product overrides. Changes apply to the next cart view, quote and
 * order - there is nothing to deploy. Pricing is ADMIN-level, not SUPPORT.
 */
@ApiTags('admin-shipping')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('admin/shipping')
export class ShippingAdminController {
  constructor(private readonly gateway: GatewayService) {}

  @Get()
  @ApiOperation({ summary: 'Settings, every category with its own and effective rule, and product overrides' })
  overview() {
    return this.gateway.catalog(CatalogPatterns.LIST_SHIPPING_RULES, {});
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update the store delivery fee, free-delivery threshold and COD' })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateShippingSettingsDto) {
    return this.gateway.catalog(CatalogPatterns.UPDATE_SHIPPING_SETTINGS, { dto, actorId: user.userId });
  }

  @Put('rules/:scope/:targetId')
  @ApiOperation({ summary: 'Set the delivery rule for a category or product' })
  upsertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scope', new ParseEnumPipe(ShippingRuleScope)) scope: ShippingRuleScope,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Body() dto: UpsertShippingRuleDto,
  ) {
    return this.gateway.catalog(CatalogPatterns.UPSERT_SHIPPING_RULE, { scope, targetId, dto, actorId: user.userId });
  }

  @Delete('rules/:scope/:targetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a rule - the target falls back to its parent category or the store default' })
  deleteRule(
    @Param('scope', new ParseEnumPipe(ShippingRuleScope)) scope: ShippingRuleScope,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.gateway.catalog(CatalogPatterns.DELETE_SHIPPING_RULE, { scope, targetId });
  }
}
