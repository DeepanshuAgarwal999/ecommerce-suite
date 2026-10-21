import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderPatterns, OrderStatus, RequestContext } from '@ecommerce/contracts';
import {
  CancelOrderDto,
  CreateOrderDto,
  QuoteOrderDto,
  RequestReturnDto,
  UpdateOrderStatusDto,
} from '@ecommerce/contracts';
import { OrderService } from './order/order.service';
import { ReturnService } from './returns/return.service';

@Controller()
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly returns: ReturnService,
  ) {}

  @MessagePattern(OrderPatterns.QUOTE)
  quote(@Payload() msg: { dto: QuoteOrderDto; ctx: RequestContext }) {
    return this.orders.quote(msg.dto, msg.ctx);
  }

  @MessagePattern(OrderPatterns.CREATE_ORDER)
  create(
    @Payload()
    msg: { user: { id: string; mobile: string; email?: string }; dto: CreateOrderDto; ctx: RequestContext },
  ) {
    return this.orders.create(msg.user, msg.dto, msg.ctx);
  }

  @MessagePattern(OrderPatterns.GET_ORDER)
  get(@Payload() msg: { orderId: string; userId?: string }) {
    return this.orders.getById(msg.orderId, msg.userId);
  }

  @MessagePattern(OrderPatterns.LIST_MY_ORDERS)
  listMine(@Payload() msg: { userId: string; page?: number; limit?: number; status?: OrderStatus }) {
    return this.orders.listForUser(msg.userId, msg);
  }

  @MessagePattern(OrderPatterns.VENDOR_LIST_ORDERS)
  listForVendor(
    @Payload() msg: { vendorId: string; page?: number; limit?: number; status?: OrderStatus },
  ) {
    return this.orders.listForVendor(msg.vendorId, msg);
  }

  @MessagePattern(OrderPatterns.ADMIN_LIST_ORDERS)
  listAll(
    @Payload()
    msg: { page?: number; limit?: number; status?: OrderStatus; q?: string; from?: string; to?: string },
  ) {
    return this.orders.listAll(msg);
  }

  @MessagePattern(OrderPatterns.ADMIN_ORDERS_SUMMARY)
  summary() {
    return this.orders.summary();
  }

  @MessagePattern(OrderPatterns.ADMIN_PRODUCT_SALES)
  productSales(@Payload() msg: { productId: string; months: number }) {
    return this.orders.productSales(msg.productId, msg.months);
  }

  @MessagePattern(OrderPatterns.ADMIN_TOP_PRODUCTS)
  topProducts(@Payload() msg: { days: number; productIds?: string[] }) {
    return this.orders.topProducts(msg.days, msg.productIds ?? []);
  }

  @MessagePattern(OrderPatterns.ADMIN_ORDERS_TREND)
  trend(@Payload() msg: { days?: number }) {
    return this.orders.trend(msg.days ?? 14);
  }

  @MessagePattern(OrderPatterns.CANCEL_ORDER)
  cancel(
    @Payload() msg: { orderId: string; userId: string | null; dto: CancelOrderDto; ctx: RequestContext },
  ) {
    return this.orders.cancel(msg.orderId, msg.userId, msg.dto.reason, msg.ctx);
  }

  @MessagePattern(OrderPatterns.UPDATE_STATUS)
  updateStatus(
    @Payload() msg: { orderId: string; dto: UpdateOrderStatusDto; ctx: RequestContext },
  ) {
    return this.orders.updateStatus(msg.orderId, msg.dto, msg.ctx);
  }

  @MessagePattern(OrderPatterns.TRACK)
  track(@Payload() msg: { orderNumber: string; userId?: string }) {
    return this.orders.track(msg.orderNumber, msg.userId);
  }

  @MessagePattern(OrderPatterns.REQUEST_RETURN)
  requestReturn(
    @Payload()
    msg: { orderId: string; userId: string; dto: RequestReturnDto; ctx: RequestContext },
  ) {
    return this.returns.request(msg.orderId, msg.userId, msg.dto, msg.ctx);
  }

  @MessagePattern(OrderPatterns.REVIEW_RETURN)
  reviewReturn(
    @Payload()
    msg: { returnId: string; approved: boolean; reason?: string; ctx: RequestContext },
  ) {
    return this.returns.review(msg.returnId, { approved: msg.approved, reason: msg.reason }, msg.ctx);
  }

  @MessagePattern(OrderPatterns.RETURN_RECEIVED)
  returnReceived(@Payload() msg: { returnId: string; ctx: RequestContext }) {
    return this.returns.markReceived(msg.returnId, msg.ctx);
  }
}
