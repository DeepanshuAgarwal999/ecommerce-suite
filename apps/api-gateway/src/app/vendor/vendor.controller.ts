import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions, Roles } from '@ecommerce/auth';
import { AppException, Ctx, ErrorCode, PaginationQueryDto } from '@ecommerce/common';
import {
  AdjustStockDto,
  ApplyVendorDto,
  AuthenticatedUser,
  CatalogPatterns,
  CreateProductDto,
  InventoryPatterns,
  OrderPatterns,
  OrderStatus,
  Permission,
  RequestContext,
  Role,
  UpdateOrderStatusDto,
  UpdateProductDto,
  UpsertStockDto,
  UserPatterns,
  VendorProductsQueryDto,
  VendorStatus,
} from '@ecommerce/contracts';
import { HttpStatus as Status } from '@nestjs/common';
import { GatewayService } from '../common/gateway.service';

interface VendorView {
  id: string;
  businessName: string;
  vendorCode: string;
  status: VendorStatus;
}

/**
 * Seller-side API.
 *
 * `apply` is open to any signed-in user; everything else requires the VENDOR role,
 * which auth-service grants when an admin approves the application. Every write is
 * additionally scoped to the caller's own vendor record - a vendor cannot edit another
 * vendor's product by guessing an id.
 */
@ApiTags('vendor')
@ApiBearerAuth('access-token')
@Controller('vendor')
export class VendorController {
  constructor(private readonly gateway: GatewayService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply to become a seller' })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyVendorDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.user(UserPatterns.APPLY_VENDOR, { userId: user.userId, dto, ctx });
  }

  @Get('me')
  @ApiOperation({ summary: 'My seller profile and application status' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.user(UserPatterns.GET_VENDOR, { userId: user.userId });
  }

  // --- products --------------------------------------------------------------

  @Get('products')
  @Roles(Role.VENDOR)
  @ApiOperation({ summary: 'My listings' })
  async products(@CurrentUser() user: AuthenticatedUser, @Query() query: VendorProductsQueryDto) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.catalog(CatalogPatterns.LIST_VENDOR_PRODUCTS, {
      vendorId: vendor.id,
      ...query,
    });
  }

  @Post('products')
  @Roles(Role.VENDOR)
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Create a product with its variants' })
  async createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Ctx() ctx: RequestContext,
  ) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.catalog(CatalogPatterns.CREATE_PRODUCT, {
      vendor: { id: vendor.id, name: vendor.businessName, code: vendor.vendorCode },
      dto,
      ctx,
    });
  }

  @Patch('products/:productId')
  @Roles(Role.VENDOR)
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Edit a product (goes back through review if live)' })
  async updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @Ctx() ctx: RequestContext,
  ) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.catalog(CatalogPatterns.UPDATE_PRODUCT, {
      productId,
      vendorId: vendor.id,
      dto,
      ctx,
    });
  }

  @Delete('products/:productId')
  @Roles(Role.VENDOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a product' })
  async archiveProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Ctx() ctx: RequestContext,
  ) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.catalog(CatalogPatterns.ARCHIVE_PRODUCT, {
      productId,
      vendorId: vendor.id,
      ctx,
    });
  }

  // --- inventory -------------------------------------------------------------

  @Put('inventory')
  @Roles(Role.VENDOR)
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiOperation({ summary: 'Set stock for a SKU in a warehouse' })
  async upsertStock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertStockDto,
    @Ctx() ctx: RequestContext,
  ) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.inventory(InventoryPatterns.UPSERT_STOCK, {
      ...dto,
      vendorId: vendor.id,
      ctx,
    });
  }

  @Post('inventory/adjust')
  @Roles(Role.VENDOR)
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Relative stock adjustment' })
  async adjustStock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustStockDto,
    @Ctx() ctx: RequestContext,
  ) {
    await this.approvedVendor(user);
    return this.gateway.inventory(InventoryPatterns.ADJUST_STOCK, { ...dto, ctx });
  }

  @Get('inventory/low-stock')
  @Roles(Role.VENDOR)
  @ApiOperation({ summary: 'SKUs at or below their reorder level' })
  async lowStock(@CurrentUser() user: AuthenticatedUser) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.inventory(InventoryPatterns.LOW_STOCK_REPORT, { vendorId: vendor.id });
  }

  @Get('inventory/warehouses')
  @Roles(Role.VENDOR)
  @ApiOperation({ summary: 'Warehouses available for stocking' })
  warehouses() {
    return this.gateway.inventory(InventoryPatterns.LIST_WAREHOUSES, {});
  }

  // --- orders ----------------------------------------------------------------

  @Get('orders')
  @Roles(Role.VENDOR)
  @ApiOperation({ summary: 'Orders containing my items' })
  async orders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: OrderStatus,
  ) {
    const vendor = await this.approvedVendor(user);
    return this.gateway.order(OrderPatterns.VENDOR_LIST_ORDERS, {
      vendorId: vendor.id,
      page: query.page,
      limit: query.limit,
      status,
    });
  }

  @Post('orders/:orderId/status')
  @Roles(Role.VENDOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark packed / shipped' })
  async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Ctx() ctx: RequestContext,
  ) {
    await this.approvedVendor(user);
    // Vendors may only move an order through the fulfilment steps they perform.
    const allowed: OrderStatus[] = [OrderStatus.PACKED, OrderStatus.SHIPPED];
    if (!allowed.includes(dto.status)) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        `Vendors can only set ${allowed.join(' or ')}`,
        Status.FORBIDDEN,
      );
    }
    return this.gateway.order(OrderPatterns.UPDATE_STATUS, { orderId, dto, ctx });
  }

  /**
   * Resolves the caller's vendor record and insists it is approved. The VENDOR role
   * alone is not enough - a suspended seller keeps the role until an admin removes it,
   * and must not be able to keep listing meanwhile.
   */
  private async approvedVendor(user: AuthenticatedUser): Promise<VendorView> {
    const vendor = await this.gateway.user<VendorView>(UserPatterns.GET_VENDOR, {
      userId: user.userId,
    });
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new AppException(
        ErrorCode.VENDOR_NOT_APPROVED,
        `Your seller account is ${vendor.status.toLowerCase()}`,
        Status.FORBIDDEN,
      );
    }
    return vendor;
  }
}
