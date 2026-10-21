import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@ecommerce/auth';
import { Ctx, IdempotencyKey } from '@ecommerce/common';
import {
  AuthenticatedUser,
  CancelOrderDto,
  CreateOrderDto,
  QuoteOrderDto,
  Headers,
  OrderPatterns,
  OrderStatus,
  RequestContext,
  RequestReturnDto,
} from '@ecommerce/contracts';
import { PaginationQueryDto } from '@ecommerce/common';
import { GatewayService } from '../common/gateway.service';
import { RateLimit } from '../common/rate-limit.guard';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly gateway: GatewayService) {}

  /**
   * Place an order.
   *
   * The `Idempotency-Key` header is what makes this safe to retry from a flaky mobile
   * connection: the same key returns the same order, never a second one. Clients should
   * generate a UUID per checkout attempt and reuse it on retry.
   */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'order-quote' })
  @ApiOperation({ summary: 'Exact price (incl. delivery, tax, COD fee) for items - creates nothing' })
  quote(@Body() dto: QuoteOrderDto, @Ctx() ctx: RequestContext) {
    return this.gateway.order(OrderPatterns.QUOTE, { dto, ctx });
  }

  @Post()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'order-create' })
  @ApiHeader({ name: Headers.IDEMPOTENCY_KEY, required: false, description: 'UUID per checkout attempt' })
  @ApiOperation({ summary: 'Place an order from the current cart' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.CREATE_ORDER, {
      user: { id: user.userId, mobile: user.mobile, email: user.email },
      dto: { ...dto, idempotencyKey },
      ctx,
    });
  }

  @Get()
  @ApiOperation({ summary: 'My orders' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: OrderStatus,
  ) {
    return this.gateway.order(OrderPatterns.LIST_MY_ORDERS, {
      userId: user.userId,
      page: query.page,
      limit: query.limit,
      status,
    });
  }

  @Get('track/:orderNumber')
  @ApiOperation({ summary: 'Delivery timeline by order number' })
  track(@CurrentUser() user: AuthenticatedUser, @Param('orderNumber') orderNumber: string) {
    return this.gateway.order(OrderPatterns.TRACK, { orderNumber, userId: user.userId });
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Order detail' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.gateway.order(OrderPatterns.GET_ORDER, { orderId, userId: user.userId });
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel before dispatch' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CancelOrderDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.CANCEL_ORDER, {
      orderId,
      userId: user.userId,
      dto,
      ctx,
    });
  }

  @Post(':orderId/returns')
  @ApiOperation({ summary: 'Request a return on a delivered order' })
  requestReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RequestReturnDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.order(OrderPatterns.REQUEST_RETURN, {
      orderId,
      userId: user.userId,
      dto,
      ctx,
    });
  }
}
