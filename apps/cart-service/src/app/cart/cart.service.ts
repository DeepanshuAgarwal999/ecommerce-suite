import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { AppException, ErrorCode, computeTotals, rpc } from '@ecommerce/common';
import {
  CacheKeys,
  CacheTtl,
  CatalogPatterns,
  InventoryPatterns,
  KafkaTopics,
  Limits,
  RequestContext,
  ServiceTokens,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { RedisService } from '@ecommerce/redis';
import { HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService } from '../coupon/coupon.service';
import { AddItemDto, UpdateItemDto } from '@ecommerce/contracts';

/** What catalog-service returns for a variant lookup. */
interface ResolvedVariant {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string> | null;
  mrp: number;
  price: number;
  imageUrl: string | null;
  product: {
    id: string;
    title: string;
    status: string;
    vendorId: string;
    vendorName: string;
    taxBps: number;
    isCodAvailable: boolean;
    media: { url: string }[];
  };
}

interface AvailabilityView {
  sku: string;
  available: number;
  inStock: boolean;
  maxOrderQuantity: number | null;
}

/**
 * The shopping cart.
 *
 * Postgres is the source of truth and Redis is a read-through cache of the assembled
 * cart. Every screen in the app shows a cart badge, so the read volume is enormous while
 * the write volume is comparatively small - exactly the shape a cache is for.
 *
 * Line prices are snapshotted when an item is added. At checkout the cart is re-priced
 * against catalog-service and any change is surfaced to the customer rather than silently
 * applied; being charged a different number than the one on screen is the fastest way to
 * lose trust.
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly rpcTimeout: number;
  private readonly freeShippingThreshold: number;
  private readonly shippingFee: number;
  private readonly codFee: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly coupons: CouponService,
    private readonly config: ConfigService,
    @Inject(ServiceTokens.CATALOG) private readonly catalog: ClientProxy,
    @Inject(ServiceTokens.INVENTORY) private readonly inventory: ClientProxy,
  ) {
    this.rpcTimeout = config.get<number>('observability.rpcTimeoutMs', 10_000);
    this.freeShippingThreshold = config.get<number>('business.freeShippingThreshold', 49900);
    this.shippingFee = config.get<number>('business.defaultShippingFee', 4900);
    this.codFee = config.get<number>('business.codFee', 2900);
  }

  async getCart(userId: string, options: { pincode?: string; refresh?: boolean } = {}) {
    if (!options.refresh) {
      const cached = await this.redis.get(CacheKeys.cart(userId));
      if (cached) return cached;
    }

    const cart = await this.loadOrCreate(userId);
    const view = await this.buildView(cart.id, userId, options.pincode);

    await this.redis.set(CacheKeys.cart(userId), view, CacheTtl.CART);
    return view;
  }

  async addItem(userId: string, dto: AddItemDto, pincode?: string) {
    const cart = await this.loadOrCreate(userId);

    const itemCount = await this.prisma.cartItem.count({ where: { cartId: cart.id } });
    if (itemCount >= Limits.MAX_CART_ITEMS) {
      throw new AppException(
        ErrorCode.CART_LIMIT_EXCEEDED,
        `A cart can hold at most ${Limits.MAX_CART_ITEMS} different items`,
        HttpStatus.CONFLICT,
      );
    }

    const [variant] = await this.resolveVariants([dto.variantId]);
    if (!variant) throw AppException.notFound('Variant', dto.variantId);
    if (variant.product.status !== 'ACTIVE') {
      throw new AppException(
        ErrorCode.PRODUCT_UNAVAILABLE,
        'This product is no longer available',
        HttpStatus.CONFLICT,
      );
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
    });

    // Adding an item already in the cart increases its quantity rather than creating a
    // duplicate line - which is what the unique constraint enforces anyway.
    const quantity = Math.min(
      (existing?.quantity ?? 0) + dto.quantity,
      Limits.MAX_CART_QUANTITY_PER_ITEM,
    );

    await this.assertAvailable(variant.sku, quantity, pincode);

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
      create: {
        cartId: cart.id,
        productId: variant.product.id,
        variantId: variant.id,
        sku: variant.sku,
        vendorId: variant.product.vendorId,
        title: variant.product.title,
        imageUrl: variant.imageUrl ?? variant.product.media[0]?.url,
        options: variant.options as never,
        quantity,
        unitPrice: variant.price,
        unitMrp: variant.mrp,
      },
      update: { quantity, unitPrice: variant.price, unitMrp: variant.mrp },
    });

    return this.refresh(cart.id, userId, pincode);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateItemDto, pincode?: string) {
    const cart = await this.loadOrCreate(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw AppException.notFound('Cart item', itemId);

    if (dto.quantity === 0) return this.removeItem(userId, itemId, pincode);

    await this.assertAvailable(item.sku, dto.quantity, pincode);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: Math.min(dto.quantity, Limits.MAX_CART_QUANTITY_PER_ITEM) },
    });

    return this.refresh(cart.id, userId, pincode);
  }

  async removeItem(userId: string, itemId: string, pincode?: string) {
    const cart = await this.loadOrCreate(userId);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.refresh(cart.id, userId, pincode);
  }

  async clear(userId: string) {
    const cart = await this.loadOrCreate(userId);
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponCode: null, couponDiscount: 0, itemCount: 0, itemTotal: 0 },
      }),
    ]);
    await this.redis.del(CacheKeys.cart(userId));
    return this.refresh(cart.id, userId);
  }

  async applyCoupon(userId: string, code: string, pincode?: string) {
    const cart = await this.loadOrCreate(userId);
    const view = await this.buildView(cart.id, userId, pincode);

    if (view.items.length === 0) {
      throw new AppException(ErrorCode.CART_EMPTY, 'Add items before applying a coupon', HttpStatus.BAD_REQUEST);
    }

    const discount = await this.coupons.validate(code, {
      userId,
      itemTotal: view.totals.itemTotal,
      vendorIds: [...new Set(view.items.map((item) => item.vendorId))],
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: code.toUpperCase(), couponDiscount: discount.amount },
    });

    return this.refresh(cart.id, userId, pincode);
  }

  async removeCoupon(userId: string, pincode?: string) {
    const cart = await this.loadOrCreate(userId);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: null, couponDiscount: 0 },
    });
    return this.refresh(cart.id, userId, pincode);
  }

  /**
   * Freezes the cart and returns a priced snapshot for order creation.
   *
   * Re-pricing here rather than trusting the stored line prices is the whole point: the
   * order is created from this snapshot, so the number the customer approved and the
   * number they are charged come from the same computation.
   */
  async checkoutSnapshot(
    userId: string,
    input: { addressId: string; pincode?: string; paymentMethod: string },
    ctx: RequestContext,
  ) {
    const cart = await this.loadOrCreate(userId);
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id } });

    if (items.length === 0) {
      throw new AppException(ErrorCode.CART_EMPTY, 'Your cart is empty', HttpStatus.BAD_REQUEST);
    }

    const variants = await this.resolveVariants(items.map((item) => item.variantId));
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    const priceChanges: { sku: string; from: number; to: number }[] = [];
    const unavailable: string[] = [];

    for (const item of items) {
      const variant = byId.get(item.variantId);
      if (!variant || variant.product.status !== 'ACTIVE') {
        unavailable.push(item.sku);
        continue;
      }
      if (variant.price !== item.unitPrice) {
        priceChanges.push({ sku: item.sku, from: item.unitPrice, to: variant.price });
      }
    }

    if (unavailable.length > 0) {
      throw new AppException(
        ErrorCode.PRODUCT_UNAVAILABLE,
        'Some items in your cart are no longer available',
        HttpStatus.CONFLICT,
        { details: { unavailable } },
      );
    }

    if (priceChanges.length > 0) {
      // Update the stored prices so the customer's next attempt reflects reality, then
      // stop and make them re-confirm.
      await this.prisma.$transaction(
        priceChanges.map((change) =>
          this.prisma.cartItem.updateMany({
            where: { cartId: cart.id, sku: change.sku },
            data: { unitPrice: change.to },
          }),
        ),
      );
      await this.redis.del(CacheKeys.cart(userId));

      throw new AppException(
        ErrorCode.PRICE_CHANGED,
        'Prices for some items have changed. Please review your cart.',
        HttpStatus.CONFLICT,
        { details: { priceChanges } },
      );
    }

    const availability = await this.checkAvailability(
      items.map((item) => item.sku),
      input.pincode,
    );
    const short = items.filter((item) => {
      const view = availability.find((entry) => entry.sku === item.sku);
      return !view || view.available < item.quantity;
    });

    if (short.length > 0) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_STOCK,
        'Some items do not have enough stock',
        HttpStatus.CONFLICT,
        {
          details: {
            unavailable: short.map((item) => ({
              sku: item.sku,
              requested: item.quantity,
              available: availability.find((entry) => entry.sku === item.sku)?.available ?? 0,
            })),
          },
        },
      );
    }

    const lines = items.map((item) => {
      const variant = byId.get(item.variantId) as ResolvedVariant;
      return {
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        vendorId: item.vendorId,
        vendorName: variant.product.vendorName,
        title: item.title,
        imageUrl: item.imageUrl,
        options: item.options,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitMrp: item.unitMrp,
        taxBps: variant.product.taxBps,
        lineTotal: item.unitPrice * item.quantity,
      };
    });

    const totals = this.priceCart(
      lines.map((line) => ({ lineTotal: line.lineTotal, taxBps: line.taxBps })),
      cart.couponDiscount,
      input.paymentMethod === 'COD',
    );

    // LOCKED stops a second tab from mutating the basket while payment is in flight.
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'LOCKED', lockedAt: new Date(), addressId: input.addressId },
    });

    return {
      cartId: cart.id,
      couponCode: cart.couponCode,
      lines,
      totals,
      correlationId: ctx.correlationId,
    };
  }

  /** Called after an order is created, to empty the basket it became. */
  async markConverted(userId: string, orderId: string, ctx: RequestContext): Promise<void> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) return;

    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          status: 'ACTIVE',
          lockedAt: null,
          convertedOrderId: orderId,
          couponCode: null,
          couponDiscount: 0,
          itemCount: 0,
          itemTotal: 0,
        },
      }),
      this.prisma.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.CART_CHECKED_OUT,
          partitionKey: userId,
          correlationId: ctx.correlationId,
          actorId: userId,
          payload: { userId, cartId: cart.id, orderId },
        }),
      }),
    ]);

    await this.redis.del(CacheKeys.cart(userId));
  }

  /** Releases a checkout lock when the order was never created. */
  async unlock(userId: string): Promise<void> {
    await this.prisma.cart.updateMany({
      where: { userId, status: 'LOCKED' },
      data: { status: 'ACTIVE', lockedAt: null },
    });
    await this.redis.del(CacheKeys.cart(userId));
  }

  // --- internals -----------------------------------------------------------

  private async loadOrCreate(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: { lastActivityAt: new Date() },
    });
  }

  private async refresh(cartId: string, userId: string, pincode?: string) {
    const view = await this.buildView(cartId, userId, pincode);
    await this.redis.set(CacheKeys.cart(userId), view, CacheTtl.CART);
    return view;
  }

  private async buildView(cartId: string, userId: string, pincode?: string) {
    const [cart, items] = await this.prisma.$transaction([
      this.prisma.cart.findUniqueOrThrow({ where: { id: cartId } }),
      this.prisma.cartItem.findMany({ where: { cartId }, orderBy: { addedAt: 'desc' } }),
    ]);

    const availability =
      items.length > 0
        ? await this.checkAvailability(items.map((item) => item.sku), pincode)
        : [];

    const enriched = items.map((item) => {
      const stock = availability.find((entry) => entry.sku === item.sku);
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        vendorId: item.vendorId,
        title: item.title,
        imageUrl: item.imageUrl,
        options: item.options,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitMrp: item.unitMrp,
        lineTotal: item.unitPrice * item.quantity,
        // Surfaced per line so the cart screen can grey out what cannot be bought
        // instead of failing the whole checkout later.
        inStock: stock ? stock.available >= item.quantity : true,
        available: stock?.available ?? null,
      };
    });

    const totals = this.priceCart(
      enriched.map((item) => ({ lineTotal: item.lineTotal, taxBps: 0 })),
      cart.couponDiscount,
      false,
    );

    // Keep the denormalised counters roughly current for the badge; exactness is not
    // required because the view is always recomputed from the lines.
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { itemCount: enriched.length, itemTotal: totals.itemTotal },
    });

    return {
      id: cart.id,
      userId,
      status: cart.status,
      couponCode: cart.couponCode,
      items: enriched,
      totals,
      updatedAt: cart.updatedAt,
    };
  }

  private priceCart(
    lines: { lineTotal: number; taxBps: number }[],
    couponDiscount: number,
    isCod: boolean,
  ) {
    const itemTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discountTotal = Math.min(couponDiscount, itemTotal);
    const shipping =
      itemTotal === 0 || itemTotal - discountTotal >= this.freeShippingThreshold
        ? 0
        : this.shippingFee;

    // Weighted average tax rate across the lines, so a mixed basket is taxed correctly
    // without having to carry per-line tax through the totals object.
    const taxable = itemTotal - discountTotal;
    const weightedBps =
      itemTotal > 0
        ? Math.round(
            lines.reduce((sum, line) => sum + line.taxBps * line.lineTotal, 0) / itemTotal,
          )
        : 0;

    return {
      ...computeTotals({
        itemTotal,
        discountTotal,
        shippingTotal: shipping,
        taxBps: weightedBps,
        codFee: isCod ? this.codFee : 0,
      }),
      freeShippingRemaining: Math.max(0, this.freeShippingThreshold - taxable),
    };
  }

  private async resolveVariants(variantIds: string[]): Promise<ResolvedVariant[]> {
    return rpc<ResolvedVariant[]>(
      this.catalog,
      CatalogPatterns.RESOLVE_VARIANTS,
      { variantIds },
      { timeoutMs: this.rpcTimeout, service: 'catalog-service' },
    );
  }

  private async checkAvailability(skus: string[], pincode?: string): Promise<AvailabilityView[]> {
    try {
      return await rpc<AvailabilityView[]>(
        this.inventory,
        InventoryPatterns.BULK_AVAILABILITY,
        { skus: [...new Set(skus)], pincode },
        { timeoutMs: this.rpcTimeout, service: 'inventory-service' },
      );
    } catch (error) {
      // Degrade rather than fail: an unreachable inventory service should not stop a
      // customer from seeing their cart. The reservation at checkout is the real gate.
      this.logger.warn(`availability lookup failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async assertAvailable(sku: string, quantity: number, pincode?: string): Promise<void> {
    const [view] = await this.checkAvailability([sku], pincode);
    if (view && view.available < quantity) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_STOCK,
        view.available === 0
          ? 'This item is out of stock'
          : `Only ${view.available} left in stock`,
        HttpStatus.CONFLICT,
        { details: { sku, requested: quantity, available: view.available } },
      );
    }
  }
}
