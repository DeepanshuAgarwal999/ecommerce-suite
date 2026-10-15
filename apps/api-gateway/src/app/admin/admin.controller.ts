import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions, Roles } from '@ecommerce/auth';
import { AppException, Ctx, PaginationQueryDto } from '@ecommerce/common';
import {
  AdjustStockDto,
  AdminIdentitiesQueryDto,
  AdminListQueryDto,
  AdminOrdersQueryDto,
  AdminStockQueryDto,
  AdminVendorsQueryDto,
  AssignRolesDto,
  AuthenticatedUser,
  AuthPatterns,
  BlockUserDto,
  BroadcastDto,
  CatalogPatterns,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateRefundDto,
  CreateWarehouseDto,
  InventoryPatterns,
  NotificationPatterns,
  OrderPatterns,
  PaymentPatterns,
  Permission,
  RequestContext,
  ReviewProductDto,
  ReviewReturnDto,
  ReviewVendorDto,
  Role,
  UpdateCategoryDto,
  UpdateOrderStatusDto,
  UpdateProductDto,
  UpsertStockDto,
  UserPatterns,
  VendorProductsQueryDto,
  VendorStatus,
} from '@ecommerce/contracts';
import { RedisService } from '@ecommerce/redis';
import { GatewayService } from '../common/gateway.service';

/**
 * Back-office API.
 *
 * Controller-level `@Roles` gates every route to staff; the finer `@RequirePermissions`
 * on individual routes is what separates SUPPORT (read) from ADMIN (write) from
 * SUPER_ADMIN (role assignment). Both guards read the JWT, so none of this costs a
 * database call.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly gateway: GatewayService,
    private readonly redis: RedisService,
  ) {}

  // --- identities ------------------------------------------------------------

  @Get('users')
  @RequirePermissions(Permission.USER_READ_ANY)
  @ApiOperation({ summary: 'Search accounts' })
  listIdentities(@Query() query: AdminIdentitiesQueryDto) {
    return this.gateway.auth(AuthPatterns.ADMIN_LIST_IDENTITIES, query);
  }

  @Get('users/profiles')
  @RequirePermissions(Permission.USER_READ_ANY)
  @ApiOperation({ summary: 'Search customer profiles' })
  listProfiles(@Query() query: AdminListQueryDto) {
    return this.gateway.user(UserPatterns.ADMIN_LIST_USERS, query);
  }

  @Patch('users/:userId/roles')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Replace a user\'s roles (super admin only)' })
  assignRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRolesDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.auth(AuthPatterns.ASSIGN_ROLES, { userId, dto, ctx });
  }

  @Patch('users/:userId/block')
  @RequirePermissions(Permission.USER_WRITE_ANY)
  @ApiOperation({ summary: 'Block or unblock an account' })
  blockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BlockUserDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.auth(AuthPatterns.BLOCK_USER, { userId, dto, ctx });
  }

  // --- vendors ---------------------------------------------------------------

  @Get('vendors')
  @ApiOperation({ summary: 'Seller applications' })
  listVendors(@Query() query: AdminVendorsQueryDto) {
    return this.gateway.user(UserPatterns.LIST_VENDORS, query);
  }

  @Get('vendors/summary')
  @ApiOperation({ summary: 'Vendor counts grouped by status, for the dashboard' })
  vendorsSummary() {
    return this.gateway.user(UserPatterns.ADMIN_VENDORS_SUMMARY, {});
  }

  @Get('vendors/:vendorId')
  @ApiOperation({ summary: 'Seller detail' })
  getVendor(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.gateway.user(UserPatterns.GET_VENDOR, { vendorId });
  }

  @Post('vendors/:vendorId/review')
  @RequirePermissions(Permission.VENDOR_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, reject or suspend a seller' })
  reviewVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: ReviewVendorDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.user(UserPatterns.REVIEW_VENDOR, { vendorId, dto, ctx });
  }

  // --- catalogue -------------------------------------------------------------

  @Post('categories')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Create a category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.gateway.catalog(CatalogPatterns.CREATE_CATEGORY, { dto });
  }

  @Patch('categories/:categoryId')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.gateway.catalog(CatalogPatterns.UPDATE_CATEGORY, { categoryId, dto });
  }

  @Post('brands')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Create a brand' })
  createBrand(@Body() dto: CreateBrandDto) {
    return this.gateway.catalog(CatalogPatterns.CREATE_BRAND, { dto });
  }

  @Get('products')
  @RequirePermissions(Permission.CATALOG_READ)
  @ApiOperation({ summary: 'Browse products across every vendor and status' })
  listProducts(
    @Query() query: VendorProductsQueryDto,
    @Query('vendorId') vendorId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.gateway.catalog(CatalogPatterns.ADMIN_SEARCH_PRODUCTS, {
      ...query,
      vendorId,
      categoryId,
    });
  }

  @Get('products/summary')
  @RequirePermissions(Permission.CATALOG_READ)
  @ApiOperation({ summary: 'Product counts grouped by status, for the dashboard' })
  productsSummary() {
    return this.gateway.catalog(CatalogPatterns.ADMIN_PRODUCTS_SUMMARY, {});
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Product detail including drafts' })
  getProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.gateway.catalog(CatalogPatterns.GET_PRODUCT, { productId, includeUnpublished: true });
  }

  @Post('products')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: "Create a product on a vendor's behalf" })
  async createProduct(
    @Body() dto: CreateProductDto & { vendorId: string },
    @Ctx() ctx: RequestContext,
  ) {
    const { vendorId, ...productDto } = dto;
    const vendor = await this.approvedVendor(vendorId);
    return this.gateway.catalog(CatalogPatterns.CREATE_PRODUCT, {
      vendor: { id: vendor.id, name: vendor.businessName, code: vendor.vendorCode },
      dto: productDto,
      ctx,
    });
  }

  @Patch('products/:productId')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @ApiOperation({ summary: 'Edit any product (bypasses vendor ownership)' })
  updateProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @Ctx() ctx: RequestContext,
  ) {
    // vendorId: null is the staff bypass ProductService.update() already supports -
    // the same escape hatch VendorController's own update route just never needed.
    return this.gateway.catalog(CatalogPatterns.UPDATE_PRODUCT, {
      productId,
      vendorId: null,
      dto,
      ctx,
    });
  }

  @Delete('products/:productId')
  @RequirePermissions(Permission.CATALOG_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive any product (bypasses vendor ownership)' })
  archiveProduct(@Param('productId', ParseUUIDPipe) productId: string, @Ctx() ctx: RequestContext) {
    return this.gateway.catalog(CatalogPatterns.ARCHIVE_PRODUCT, { productId, vendorId: null, ctx });
  }

  @Post('products/:productId/review')
  @RequirePermissions(Permission.CATALOG_PUBLISH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a product listing' })
  reviewProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReviewProductDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.catalog(CatalogPatterns.REVIEW_PRODUCT, { productId, dto, ctx });
  }

  // --- inventory -------------------------------------------------------------

  @Get('warehouses')
  @ApiOperation({ summary: 'Warehouses and dark stores' })
  warehouses() {
    return this.gateway.inventory(InventoryPatterns.LIST_WAREHOUSES, {});
  }

  @Post('warehouses')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiOperation({ summary: 'Create a warehouse or dark store' })
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.gateway.inventory(InventoryPatterns.CREATE_WAREHOUSE, dto);
  }

  @Get('inventory')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Browse stock across every vendor and warehouse' })
  listStock(@Query() query: AdminStockQueryDto) {
    return this.gateway.inventory(InventoryPatterns.LIST_STOCK, query);
  }

  @Get('inventory/low-stock')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'SKUs at or below their reorder level, platform-wide' })
  lowStock() {
    return this.gateway.inventory(InventoryPatterns.LOW_STOCK_REPORT, {});
  }

  @Post('inventory')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiOperation({ summary: 'Set stock on behalf of a vendor' })
  upsertStock(
    @Body() dto: UpsertStockDto & { vendorId: string },
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.inventory(InventoryPatterns.UPSERT_STOCK, { ...dto, ctx });
  }

  @Post('inventory/adjust')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust stock' })
  adjustStock(@Body() dto: AdjustStockDto, @Ctx() ctx: RequestContext) {
    return this.gateway.inventory(InventoryPatterns.ADJUST_STOCK, { ...dto, ctx });
  }

  @Get('inventory/movements')
  @ApiOperation({ summary: 'Stock ledger' })
  movements(
    @Query() query: PaginationQueryDto,
    @Query('sku') sku?: string,
    @Query('referenceId') referenceId?: string,
  ) {
    return this.gateway.inventory(InventoryPatterns.LIST_MOVEMENTS, {
      sku,
      referenceId,
      page: query.page,
      limit: query.limit,
    });
  }

  // --- orders ----------------------------------------------------------------

  @Get('orders')
  @RequirePermissions(Permission.ORDER_READ_ANY)
  @ApiOperation({ summary: 'All orders' })
  listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.gateway.order(OrderPatterns.ADMIN_LIST_ORDERS, query);
  }

  @Get('orders/summary')
  @RequirePermissions(Permission.ORDER_READ_ANY)
  @ApiOperation({ summary: 'Order counts grouped by status, for the dashboard' })
  ordersSummary() {
    return this.gateway.order(OrderPatterns.ADMIN_ORDERS_SUMMARY, {});
  }

  @Get('orders/trend')
  @RequirePermissions(Permission.ORDER_READ_ANY)
  @ApiOperation({ summary: 'Order count per day for the trailing N days, for the dashboard' })
  ordersTrend(@Query('days') days?: string) {
    return this.gateway.order(OrderPatterns.ADMIN_ORDERS_TREND, {
      days: days ? Number(days) : undefined,
    });
  }

  @Get('orders/:orderId')
  @RequirePermissions(Permission.ORDER_READ_ANY)
  @ApiOperation({ summary: 'Order detail' })
  getOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.gateway.order(OrderPatterns.GET_ORDER, { orderId });
  }

  @Post('orders/:orderId/status')
  @RequirePermissions(Permission.ORDER_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force a status transition' })
  updateOrderStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.UPDATE_STATUS, { orderId, dto, ctx });
  }

  @Post('orders/:orderId/cancel')
  @RequirePermissions(Permission.ORDER_CANCEL_ANY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel any order' })
  cancelOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: { reason: string },
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.CANCEL_ORDER, { orderId, userId: null, dto, ctx });
  }

  @Post('returns/:returnId/review')
  @RequirePermissions(Permission.ORDER_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a return' })
  reviewReturn(
    @Param('returnId', ParseUUIDPipe) returnId: string,
    @Body() dto: ReviewReturnDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.REVIEW_RETURN, { returnId, ...dto, ctx });
  }

  @Post('returns/:returnId/received')
  @RequirePermissions(Permission.ORDER_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Goods received; triggers the refund' })
  returnReceived(@Param('returnId', ParseUUIDPipe) returnId: string, @Ctx() ctx: RequestContext) {
    return this.gateway.order(OrderPatterns.RETURN_RECEIVED, { returnId, ctx });
  }

  // --- payments --------------------------------------------------------------

  @Post('refunds')
  @RequirePermissions(Permission.PAYMENT_REFUND)
  @ApiOperation({ summary: 'Issue a manual refund' })
  refund(@Body() dto: CreateRefundDto, @Ctx() ctx: RequestContext) {
    return this.gateway.payment(PaymentPatterns.REFUND, { dto, ctx });
  }

  @Get('refunds')
  @RequirePermissions(Permission.PAYMENT_READ)
  @ApiOperation({ summary: 'Refund history' })
  listRefunds(@Query() query: PaginationQueryDto, @Query('orderId') orderId?: string) {
    return this.gateway.payment(PaymentPatterns.LIST_REFUNDS, {
      orderId,
      page: query.page,
      limit: query.limit,
    });
  }

  // --- notifications ---------------------------------------------------------

  @Post('notifications/broadcast')
  @RequirePermissions(Permission.NOTIFICATION_BROADCAST)
  @ApiOperation({ summary: 'Send a campaign to a list of users' })
  broadcast(@Body() dto: BroadcastDto, @Ctx() ctx: RequestContext) {
    return this.gateway.notification(NotificationPatterns.BROADCAST, { ...dto, ctx });
  }

  // --- settings ----------------------------------------------------------------

  /**
   * Wipes every key in the shared Redis instance - rate-limit counters, OTP codes
   * in flight, and every service's warm cache (categories, products, sessions'
   * supporting data). Nothing here is a system of record (Postgres is), so this is
   * safe in the sense that no business data is lost, but it does sign every active
   * user's rate-limit budget back to zero and forces a cold-cache moment across the
   * platform. Restricted past the controller's own staff gate to SUPER_ADMIN only -
   * the same bar as role assignment, the other action with platform-wide blast radius.
   */
  @Post('settings/reset-cache')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flush the entire Redis cache (rate limits, OTPs, warm caches)' })
  async resetCache(@CurrentUser() user: AuthenticatedUser) {
    const deletedKeys = await this.redis.deleteByPattern('*');
    this.logger.warn(`Redis cache reset by ${user.userId} - ${deletedKeys} keys deleted`);
    return { deletedKeys };
  }

  /**
   * Resolves a vendor by id for `createProduct` and insists it is approved - the same
   * rule VendorController.approvedVendor() enforces for a vendor acting on their own
   * behalf, applied here to whichever vendor the admin picked.
   */
  private async approvedVendor(
    vendorId: string,
  ): Promise<{ id: string; businessName: string; vendorCode: string; status: VendorStatus }> {
    const vendor = await this.gateway.user<{
      id: string;
      businessName: string;
      vendorCode: string;
      status: VendorStatus;
    }>(UserPatterns.GET_VENDOR, { vendorId });

    if (vendor.status !== VendorStatus.APPROVED) {
      throw AppException.conflict(
        `${vendor.businessName} is ${vendor.status.toLowerCase()}, not approved - only approved vendors can be listed for`,
      );
    }
    return vendor;
  }
}
