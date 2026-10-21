import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppException,
  ErrorCode,
  distributeProportionally,
  generateOrderNumber,
  rpc,
} from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  CacheTtl,
  canTransition,
  CartPatterns,
  CUSTOMER_CANCELLABLE,
  FulfilmentType,
  KafkaTopics,
  Limits,
  OrderStatus,
  PaymentMethod,
  RequestContext,
  SagaStatus,
  ServiceTokens,
  UserPatterns,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/order';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, QuoteOrderDto, UpdateOrderStatusDto } from '@ecommerce/contracts';

interface CheckoutSnapshot {
  /** null for a DIRECT snapshot (explicit items, server cart untouched). */
  cartId: string | null;
  basket?: 'CART' | 'DIRECT';
  couponCode: string | null;
  lines: {
    productId: string;
    variantId: string;
    sku: string;
    vendorId: string;
    vendorName: string;
    title: string;
    imageUrl: string | null;
    options: unknown;
    quantity: number;
    unitPrice: number;
    unitMrp: number;
    taxBps: number;
    lineTotal: number;
  }[];
  totals: {
    itemTotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    codFee: number;
    grandTotal: number;
  };
}

interface AddressView {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * The order aggregate.
 *
 * Creating an order is the most consequential write in the system, so three things are
 * true of it:
 *
 *  - It is idempotent. The client sends an `Idempotency-Key`; a unique index on it means
 *    a retried submission returns the original order instead of creating a second one.
 *  - It is a snapshot. Prices, titles and the delivery address are copied in, so the
 *    invoice cannot change when the catalogue does.
 *  - It only *starts* the work. Reserving stock and taking payment happen asynchronously
 *    through the saga, so a slow payment gateway does not hold an HTTP connection open.
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly holdSeconds: number;
  private readonly rpcTimeout: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    @Inject(ServiceTokens.CART) private readonly cart: ClientProxy,
    @Inject(ServiceTokens.USER) private readonly users: ClientProxy,
  ) {
    this.holdSeconds = config.get<number>('business.stockHoldSeconds', Limits.STOCK_HOLD_SECONDS);
    this.rpcTimeout = config.get<number>('observability.rpcTimeoutMs', 10_000);
  }

  async create(
    user: { id: string; mobile: string; email?: string },
    dto: CreateOrderDto,
    ctx: RequestContext,
  ) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) return this.replay(existing, user.id, dto);
    }

    const [address, snapshot] = await Promise.all([
      rpc<AddressView>(
        this.users,
        UserPatterns.GET_ADDRESS,
        { userId: user.id, addressId: dto.addressId },
        { timeoutMs: this.rpcTimeout, service: 'user-service' },
      ),
      rpc<CheckoutSnapshot>(
        this.cart,
        CartPatterns.CHECKOUT_SNAPSHOT,
        {
          userId: user.id,
          dto: {
            addressId: dto.addressId,
            paymentMethod: dto.paymentMethod,
            pincode: dto.pincode,
            // Direct items ("Buy now" / browser cart) are priced instead of the server cart.
            items: dto.items,
          },
          ctx,
        },
        { timeoutMs: this.rpcTimeout, service: 'cart-service' },
      ),
    ]);

    if (snapshot.lines.length === 0) {
      throw new AppException(ErrorCode.CART_EMPTY, 'Your cart is empty', HttpStatus.BAD_REQUEST);
    }

    // Spread the order-level discount across lines by value, so a later per-item refund
    // returns exactly what that item contributed to the charge.
    const discountShares = distributeProportionally(
      snapshot.totals.discountTotal,
      snapshot.lines.map((line) => line.lineTotal),
    );

    const orderNumber = generateOrderNumber();
    const reservationId = randomUUID();

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            userMobile: user.mobile,
            userEmail: user.email,
            status: OrderStatus.PENDING_PAYMENT,
            fulfilmentType: dto.fulfilmentType ?? FulfilmentType.STANDARD,
            source: ctx.source ?? 'API',
            appVersion: ctx.appVersion,
            itemTotal: snapshot.totals.itemTotal,
            discountTotal: snapshot.totals.discountTotal,
            shippingTotal: snapshot.totals.shippingTotal,
            taxTotal: snapshot.totals.taxTotal,
            codFee: snapshot.totals.codFee,
            grandTotal: snapshot.totals.grandTotal,
            couponCode: snapshot.couponCode,
            paymentMethod: dto.paymentMethod,
            shippingAddress: this.freezeAddress(address) as never,
            reservationId,
            idempotencyKey: dto.idempotencyKey,
            notes: dto.notes,
            items: {
              create: snapshot.lines.map((line, index) => {
                const discount = discountShares[index] ?? 0;
                const taxable = line.lineTotal - discount;
                return {
                  productId: line.productId,
                  variantId: line.variantId,
                  sku: line.sku,
                  vendorId: line.vendorId,
                  vendorName: line.vendorName,
                  title: line.title,
                  imageUrl: line.imageUrl,
                  options: line.options as never,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  unitMrp: line.unitMrp,
                  discount,
                  taxBps: line.taxBps,
                  taxAmount: Math.round((taxable * line.taxBps) / 10_000),
                  lineTotal: line.lineTotal,
                };
              }),
            },
            statusHistory: {
              create: { toStatus: OrderStatus.PENDING_PAYMENT, changedBy: user.id },
            },
            saga: {
              create: {
                status: SagaStatus.AWAITING_INVENTORY,
                currentStep: 'ORDER_CREATED',
                timeoutAt: new Date(Date.now() + this.holdSeconds * 1000),
              },
            },
          },
          include: { items: true },
        });

        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.ORDER_CREATED,
            partitionKey: created.id,
            correlationId: ctx.correlationId,
            actorId: user.id,
            source: ctx.source,
            // DIRECT orders must not empty the shopper's server cart (see cart-service consumer).
            payload: { ...this.toCreatedPayload(created, created.items), basket: snapshot.basket ?? 'CART' },
          }),
        });

        // Kicks off the saga. inventory-service answers on its own topic.
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.STOCK_RESERVE_REQUESTED,
            partitionKey: created.id,
            correlationId: ctx.correlationId,
            actorId: user.id,
            source: ctx.source,
            payload: {
              orderId: created.id,
              reservationId,
              userId: user.id,
              holdSeconds: this.holdSeconds,
              lines: created.items.map((item) => ({
                sku: item.sku,
                variantId: item.variantId,
                quantity: item.quantity,
              })),
            },
          }),
        });

        return created;
      });
    } catch (error) {
      // Two identical requests raced (double-tap, client retry before the first
      // answered): both missed the lookup above, the unique index stopped the second
      // insert. Answer it with the order the first one created.
      if (
        dto.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.order.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { items: true },
        });
        if (winner) return this.replay(winner, user.id, dto);
      }
      throw error;
    }

    this.logger.log(`order ${order.orderNumber} created for ${user.id}`);
    return order;
  }

  /**
   * Exact price for explicit items - same cart-service pricing as `create`, nothing
   * persisted or reserved. Direct items only: quoting the server cart would lock it.
   */
  async quote(dto: QuoteOrderDto, ctx: RequestContext) {
    const snapshot = await rpc<CheckoutSnapshot>(
      this.cart,
      CartPatterns.CHECKOUT_SNAPSHOT,
      {
        userId: ctx.userId ?? 'quote',
        // Not used by direct pricing; the snapshot contract still requires the field.
        dto: { addressId: '00000000-0000-4000-8000-000000000000', paymentMethod: dto.paymentMethod, pincode: dto.pincode, items: dto.items },
        ctx,
      },
      { timeoutMs: this.rpcTimeout, service: 'cart-service' },
    );
    return {
      lines: snapshot.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        title: line.title,
        imageUrl: line.imageUrl,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitMrp: line.unitMrp,
        lineTotal: line.lineTotal,
      })),
      totals: snapshot.totals,
    };
  }

  /**
   * An Idempotency-Key we've seen before: hand back the original order - but only to
   * the same shopper for the same request. Keys are unique platform-wide, so without
   * the owner check a leaked key would return someone else's order; and reusing a key
   * for a different basket is a client bug that must fail loudly, not silently return
   * the old order (the Stripe rule).
   */
  private replay(
    existing: Prisma.OrderGetPayload<{ include: { items: true } }>,
    userId: string,
    dto: CreateOrderDto,
  ) {
    const conflict = (reason: string) =>
      new AppException(ErrorCode.IDEMPOTENCY_CONFLICT, reason, HttpStatus.UNPROCESSABLE_ENTITY);

    if (existing.userId !== userId) throw conflict('This Idempotency-Key has already been used');
    if (existing.paymentMethod !== dto.paymentMethod) {
      throw conflict('This Idempotency-Key was used for an order with a different payment method');
    }
    if (dto.items?.length) {
      const sum = (rows: { productId: string; quantity: number }[]) => {
        const totals = new Map<string, number>();
        rows.forEach((row) => totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity));
        return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([id, qty]) => `${id}x${qty}`).join(',');
      };
      if (sum(dto.items) !== sum(existing.items)) {
        throw conflict('This Idempotency-Key was used for a different set of items');
      }
    }
    this.logger.log(`idempotent replay for key ${dto.idempotencyKey} -> ${existing.id}`);
    return existing;
  }

  /**
   * Sales history for one product (admin product insights): per month and for the
   * last 90 days. Sold = the order went through (not draft / unpaid / failed /
   * cancelled); cancellations and returns are reported separately so a product that
   * sells but keeps coming back is visible.
   */
  async productSales(productId: string, months: number) {
    type MonthRow = { month: string; orders: bigint; units: bigint; revenue: bigint; cancelled_units: bigint; returned_units: bigint };
    const [monthly, last90, buyers] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', o."createdAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
               count(DISTINCT o."id") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED'))::bigint AS orders,
               coalesce(sum(oi."quantity") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED')), 0)::bigint AS units,
               coalesce(sum(oi."lineTotal") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED')), 0)::bigint AS revenue,
               coalesce(sum(oi."quantity") FILTER (WHERE o."status" = 'CANCELLED'), 0)::bigint AS cancelled_units,
               coalesce(sum(oi."quantity") FILTER (WHERE oi."status" = 'RETURNED'), 0)::bigint AS returned_units
        FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
        WHERE oi."productId" = ${productId}::uuid
          AND o."createdAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - make_interval(months => ${months - 1}::int)
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ orders: bigint; units: bigint; revenue: bigint; cancelled_units: bigint; returned_units: bigint; buyers: bigint }[]>`
        SELECT count(DISTINCT o."id") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED'))::bigint AS orders,
               coalesce(sum(oi."quantity") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED')), 0)::bigint AS units,
               coalesce(sum(oi."lineTotal") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED')), 0)::bigint AS revenue,
               coalesce(sum(oi."quantity") FILTER (WHERE o."status" = 'CANCELLED'), 0)::bigint AS cancelled_units,
               coalesce(sum(oi."quantity") FILTER (WHERE oi."status" = 'RETURNED'), 0)::bigint AS returned_units,
               count(DISTINCT o."userId") FILTER (WHERE o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED'))::bigint AS buyers
        FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
        WHERE oi."productId" = ${productId}::uuid AND o."createdAt" >= now() - interval '90 days'`,
      this.prisma.$queryRaw<{ buyers: bigint; repeat_buyers: bigint; first_sale: Date | null; last_sale: Date | null }[]>`
        SELECT count(*)::bigint AS buyers, count(*) FILTER (WHERE n > 1)::bigint AS repeat_buyers,
               min(first_at) AS first_sale, max(last_at) AS last_sale
        FROM (
          SELECT o."userId", count(DISTINCT o."id") AS n, min(o."createdAt") AS first_at, max(o."createdAt") AS last_at
          FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
          WHERE oi."productId" = ${productId}::uuid AND o."status" NOT IN ('DRAFT','PENDING_PAYMENT','PAYMENT_FAILED','CANCELLED')
          GROUP BY o."userId"
        ) per_buyer`,
    ]);
    const n = (value: bigint | null | undefined) => Number(value ?? 0);
    const l = last90[0];
    return {
      monthly: monthly.map((row) => ({
        month: row.month,
        orders: n(row.orders),
        units: n(row.units),
        revenue: n(row.revenue),
        cancelledUnits: n(row.cancelled_units),
        returnedUnits: n(row.returned_units),
      })),
      last90: {
        orders: n(l?.orders),
        units: n(l?.units),
        revenue: n(l?.revenue),
        cancelledUnits: n(l?.cancelled_units),
        returnedUnits: n(l?.returned_units),
        buyers: n(l?.buyers),
      },
      lifetime: {
        buyers: n(buyers[0]?.buyers),
        repeatBuyers: n(buyers[0]?.repeat_buyers),
        firstSaleAt: buyers[0]?.first_sale?.toISOString() ?? null,
        lastSaleAt: buyers[0]?.last_sale?.toISOString() ?? null,
      },
    };
  }

  async getById(orderId: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
        shipments: true,
        returns: { include: { items: true } },
        // payment-service only opens a payment once stock is held (see createCheckout).
        saga: { select: { inventoryReserved: true, status: true } },
      },
    });

    if (!order) throw AppException.notFound('Order', orderId);
    // Same 404 rather than 403: confirming an order exists but belongs to someone else
    // is itself an information leak.
    if (userId && order.userId !== userId) throw AppException.notFound('Order', orderId);

    return order;
  }

  async listForUser(
    userId: string,
    query: { page?: number; limit?: number; status?: OrderStatus },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      // Drafts are an internal state; never show them in order history.
      NOT: { status: OrderStatus.DRAFT },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: { select: { title: true, imageUrl: true, quantity: true, sku: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async listForVendor(
    vendorId: string,
    query: { page?: number; limit?: number; status?: OrderStatus },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    // A vendor sees orders containing their items, and only their lines within them.
    const where: Prisma.OrderWhereInput = {
      items: { some: { vendorId } },
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          shippingAddress: true,
          items: { where: { vendorId } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async listAll(query: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { userMobile: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Order counts grouped by status, for the admin dashboard's status chart.
   * One query instead of the gateway firing a separate `limit=1` filtered
   * list call per status - that pattern alone was contributing ~6 of the
   * ~30 requests a single dashboard load fired, and combined with the
   * per-day trend calls below was enough to trip the rate limiter.
   *
   * Cached briefly: every staff member's dashboard hits this on every load,
   * and a status breakdown has no reason to be querying Postgres fresh on
   * each one. `cache.wrap` also collapses concurrent misses into a single
   * query, so a burst of admins loading the dashboard at once still only
   * runs this once.
   */
  async summary(): Promise<{ status: OrderStatus; count: number }[]> {
    return this.cache.wrap(
      CacheKeys.adminSummary('orders'),
      async () => {
        const rows = await this.prisma.order.groupBy({
          by: ['status'],
          _count: { _all: true },
        });
        return rows.map((row) => ({ status: row.status, count: row._count._all }));
      },
      { ttlSeconds: CacheTtl.ADMIN_SUMMARY },
    );
  }

  /**
   * Order count per day for the trailing `days` days, oldest first. One
   * query instead of the gateway firing one `limit=1` filtered list call
   * per day - that was the actual culprit behind the rate-limit storm this
   * replaces (14 requests per dashboard load, doubled by React Strict
   * Mode, tripping the 120/60s default budget within a couple of loads).
   *
   * `generate_series` fills in days with zero orders, which a bare
   * `GROUP BY` would silently drop. `make_interval` builds the lookback
   * window from a bound parameter rather than string-concatenating it into
   * the interval literal - the dependable way to make an interval dynamic
   * in Postgres, and it keeps the whole query index-friendly against the
   * existing `@@index([createdAt])`.
   */
  async trend(days: number): Promise<{ date: string; orders: number }[]> {
    return this.cache.wrap(
      CacheKeys.adminOrderTrend(days),
      async () => {
        const rows = await this.prisma.$queryRaw<{ date: Date; orders: bigint }[]>`
          SELECT day::date AS date, COUNT("orders"."id")::int AS orders
          FROM generate_series(
            date_trunc('day', now()) - make_interval(days => ${days - 1}::int),
            date_trunc('day', now()),
            '1 day'
          ) AS day
          LEFT JOIN "orders" ON date_trunc('day', "orders"."createdAt") = day
          GROUP BY day
          ORDER BY day ASC
        `;
        return rows.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          orders: Number(row.orders),
        }));
      },
      { ttlSeconds: CacheTtl.ADMIN_SUMMARY },
    );
  }

  /**
   * Best sellers over the trailing `days` days: units, distinct orders and revenue
   * per product, from order lines whose order actually went through - drafts,
   * unpaid, failed-payment and cancelled orders are excluded, so a basket someone
   * abandoned at payment never counts as a sale.
   *
   * `productIds` additionally returns the same stats for specific products (the
   * Insights page asks for the most-viewed ones to compute view -> order
   * conversion), whether or not they made the top list.
   *
   * One grouped query each, against the existing `orders(createdAt)` index.
   */
  async topProducts(days: number, productIds: string[] = []) {
    const ids = [...new Set(productIds)].slice(0, 50).sort();
    return this.cache.wrap(
      `${CacheKeys.adminInsights('orders', days)}:${ids.join(',')}`,
      async () => {
        const counted = Prisma.sql`
          o."createdAt" >= now() - make_interval(days => ${days}::int)
          AND o."status" NOT IN ('DRAFT', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED')`;

        type Row = {
          productId: string;
          title: string;
          imageUrl: string | null;
          units: bigint;
          orders: bigint;
          revenue: bigint;
        };
        const select = Prisma.sql`
          SELECT oi."productId",
                 max(oi."title") AS title,
                 max(oi."imageUrl") AS "imageUrl",
                 sum(oi."quantity")::bigint AS units,
                 count(DISTINCT oi."orderId")::bigint AS orders,
                 sum(oi."lineTotal")::bigint AS revenue
          FROM "order_items" oi
          JOIN "orders" o ON o."id" = oi."orderId"`;

        const [top, forIds, totals] = await Promise.all([
          this.prisma.$queryRaw<Row[]>`
            ${select}
            WHERE ${counted}
            GROUP BY oi."productId"
            ORDER BY units DESC, revenue DESC
            LIMIT 20`,
          ids.length
            ? this.prisma.$queryRaw<Row[]>`
                ${select}
                WHERE ${counted} AND oi."productId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
                GROUP BY oi."productId"`
            : Promise.resolve([] as Row[]),
          this.prisma.$queryRaw<{ orders: bigint; units: bigint; revenue: bigint }[]>`
            SELECT count(DISTINCT o."id")::bigint AS orders,
                   coalesce(sum(oi."quantity"), 0)::bigint AS units,
                   coalesce(sum(oi."lineTotal"), 0)::bigint AS revenue
            FROM "orders" o
            JOIN "order_items" oi ON oi."orderId" = o."id"
            WHERE ${counted}`,
        ]);

        const toPlain = (row: Row) => ({
          productId: row.productId,
          title: row.title,
          imageUrl: row.imageUrl,
          units: Number(row.units),
          orders: Number(row.orders),
          revenue: Number(row.revenue),
        });

        return {
          totals: {
            orders: Number(totals[0]?.orders ?? 0),
            units: Number(totals[0]?.units ?? 0),
            revenue: Number(totals[0]?.revenue ?? 0),
          },
          top: top.map(toPlain),
          byProduct: forIds.map(toPlain),
        };
      },
      { ttlSeconds: CacheTtl.ADMIN_INSIGHTS },
    );
  }

  /**
   * Moves an order to a new status.
   *
   * Every transition goes through `canTransition`, so an invalid jump is rejected the
   * same way whether it came from an admin screen, a courier webhook or a saga
   * compensation. Without a single gate, each caller invents its own rules and they
   * diverge.
   */
  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    ctx: RequestContext,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw AppException.notFound('Order', orderId);

    if (order.status === dto.status) return order;

    if (!canTransition(order.status, dto.status)) {
      throw new AppException(
        ErrorCode.INVALID_ORDER_TRANSITION,
        `An order cannot move from ${order.status} to ${dto.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.applyStatus(orderId, dto.status, {
      reason: dto.reason,
      changedBy: ctx.userId,
      correlationId: ctx.correlationId,
    });
  }

  /** Customer-initiated cancellation, allowed only before the parcel is in transit. */
  async cancel(orderId: string, userId: string | null, reason: string, ctx: RequestContext) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw AppException.notFound('Order', orderId);
    if (userId && order.userId !== userId) throw AppException.notFound('Order', orderId);

    if (userId && !CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new AppException(
        ErrorCode.ORDER_NOT_CANCELLABLE,
        `An order that is already ${order.status} cannot be cancelled. Request a return instead.`,
        HttpStatus.CONFLICT,
      );
    }

    return this.applyStatus(orderId, OrderStatus.CANCELLED, {
      reason,
      changedBy: userId ?? ctx.userId,
      correlationId: ctx.correlationId,
    });
  }

  /**
   * Writes a status change plus its history row and outbound events in one transaction.
   * Shared by the API, the saga and the consumers so the side effects can never diverge
   * from the state change.
   */
  async applyStatus(
    orderId: string,
    status: OrderStatus,
    options: { reason?: string; changedBy?: string; correlationId?: string } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(status === OrderStatus.CANCELLED
            ? {
                cancelledAt: new Date(),
                cancellationReason: options.reason,
                cancelledBy: options.changedBy,
              }
            : {}),
          ...(status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
        include: { items: true },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: current.status,
          toStatus: status,
          reason: options.reason,
          changedBy: options.changedBy,
        },
      });

      const payload = {
        orderId,
        orderNumber: updated.orderNumber,
        userId: updated.userId,
        previousStatus: current.status,
        status,
        reason: options.reason,
        changedBy: options.changedBy,
      };

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.ORDER_STATUS_CHANGED,
          partitionKey: orderId,
          correlationId: options.correlationId,
          actorId: options.changedBy,
          payload,
        }),
      });

      // Terminal and near-terminal states get their own topic so consumers that only
      // care about "cancelled" or "confirmed" do not have to filter the firehose.
      const dedicatedTopic =
        status === OrderStatus.CANCELLED
          ? KafkaTopics.ORDER_CANCELLED
          : status === OrderStatus.CONFIRMED
            ? KafkaTopics.ORDER_CONFIRMED
            : status === OrderStatus.DELIVERED
              ? KafkaTopics.ORDER_DELIVERED
              : null;

      if (dedicatedTopic) {
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: dedicatedTopic,
            partitionKey: orderId,
            correlationId: options.correlationId,
            actorId: options.changedBy,
            payload:
              dedicatedTopic === KafkaTopics.ORDER_CONFIRMED
                ? this.toCreatedPayload(updated, updated.items)
                : payload,
          }),
        });
      }

      return updated;
    });
  }

  async track(orderNumber: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        statusHistory: { orderBy: { createdAt: 'asc' } },
        shipments: true,
      },
    });

    if (!order) throw AppException.notFound('Order', orderNumber);
    if (userId && order.userId !== userId) throw AppException.notFound('Order', orderNumber);

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      expectedDeliveryAt: order.expectedDeliveryAt,
      deliveredAt: order.deliveredAt,
      timeline: order.statusHistory.map((entry) => ({
        status: entry.toStatus,
        at: entry.createdAt,
        reason: entry.reason,
      })),
      shipments: order.shipments,
    };
  }

  // --- helpers -------------------------------------------------------------

  private freezeAddress(address: AddressView) {
    // Only the fields needed to deliver and to print an invoice. Copying the whole row
    // would drag along mutable flags like `isDefault` that mean nothing historically.
    return {
      addressId: address.id,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  }

  private toCreatedPayload(
    order: {
      id: string;
      orderNumber: string;
      userId: string;
      status: OrderStatus;
      fulfilmentType: FulfilmentType;
      currency: string;
      itemTotal: number;
      discountTotal: number;
      shippingTotal: number;
      taxTotal: number;
      grandTotal: number;
      paymentMethod: PaymentMethod;
      shippingAddress: unknown;
      createdAt: Date;
      source?: string;
    },
    items: {
      id: string;
      productId: string;
      variantId: string;
      sku: string;
      vendorId: string;
      title: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[],
  ) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      fulfilmentType: order.fulfilmentType,
      currency: order.currency,
      itemTotal: order.itemTotal,
      discountTotal: order.discountTotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      addressId: (order.shippingAddress as { addressId?: string })?.addressId ?? '',
      placedAt: order.createdAt.toISOString(),
      source: order.source,
      lines: items.map((item) => ({
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        vendorId: item.vendorId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.lineTotal,
      })),
    };
  }
}
