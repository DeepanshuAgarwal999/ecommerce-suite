import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { AppException, ErrorCode, computeShipping, computeTotals, rpc } from '@ecommerce/common';
import {
  CacheKeys,
  CacheTtl,
  CatalogPatterns,
  InventoryPatterns,
  KafkaTopics,
  Limits,
  RequestContext,
  ServiceTokens,
  ShippingContext,
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly coupons: CouponService,
    private readonly config: ConfigService,
    @Inject(ServiceTokens.CATALOG) private readonly catalog: ClientProxy,
    @Inject(ServiceTokens.INVENTORY) private readonly inventory: ClientProxy,
  ) {
    this.rpcTimeout = config.get<number>('observability.rpcTimeoutMs', 10_000);
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
    input: {
      addressId: string;
      pincode?: string;
      paymentMethod: string;
      items?: { productId: string; variantId?: string; quantity: number }[];
    },
    ctx: RequestContext,
  ) {
    if (input.items?.length) return this.directSnapshot(input.items, input, ctx);

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

    const totals = await this.priceCart(lines, cart.couponDiscount, input.paymentMethod === 'COD');

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
      basket: 'CART' as const,
      correlationId: ctx.correlationId,
    };
  }

  /**
   * Prices explicit lines ("Buy now", or a client-held cart) with the same rules as the
   * server cart - live catalog price, active products only, stock check, shared
   * totals - but never reads, locks or empties the stored cart. Prices come from the
   * catalog here, not the client, so there is no "price changed" step: what the shopper
   * confirms on the next screen is what this computed.
   */
  private async directSnapshot(
    items: { productId: string; variantId?: string; quantity: number }[],
    input: { pincode?: string; paymentMethod: string },
    ctx: RequestContext,
  ) {
    const variants = await rpc<ResolvedVariant[]>(
      this.catalog,
      CatalogPatterns.RESOLVE_VARIANTS,
      {
        variantIds: items.flatMap((item) => (item.variantId ? [item.variantId] : [])),
        productIds: items.flatMap((item) => (item.variantId ? [] : [item.productId])),
      },
      { timeoutMs: this.rpcTimeout, service: 'catalog-service' },
    );

    // Same variant requested twice (e.g. two rows of one product) -> one line.
    const merged = new Map<string, { variant: ResolvedVariant; quantity: number }>();
    const unavailable: string[] = [];
    for (const item of items) {
      const variant = item.variantId
        ? variants.find((row) => row.id === item.variantId && row.product.id === item.productId)
        : variants.find((row) => row.product.id === item.productId);
      if (!variant || variant.product.status !== 'ACTIVE') {
        unavailable.push(item.productId);
        continue;
      }
      const existing = merged.get(variant.id);
      merged.set(variant.id, { variant, quantity: (existing?.quantity ?? 0) + item.quantity });
    }
    if (unavailable.length > 0) {
      throw new AppException(
        ErrorCode.PRODUCT_UNAVAILABLE,
        'Some items are no longer available',
        HttpStatus.CONFLICT,
        { details: { unavailable } },
      );
    }
    if (input.paymentMethod === 'COD') {
      const noCod = [...merged.values()].filter(({ variant }) => !variant.product.isCodAvailable);
      if (noCod.length) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          'Cash on delivery is not available for some items',
          HttpStatus.BAD_REQUEST,
          { details: { skus: noCod.map(({ variant }) => variant.sku) } },
        );
      }
    }

    const availability = await this.checkAvailability([...merged.values()].map(({ variant }) => variant.sku), input.pincode);
    const short = [...merged.values()].filter(({ variant, quantity }) => {
      const view = availability.find((entry) => entry.sku === variant.sku);
      return !view || view.available < quantity;
    });
    if (short.length > 0) {
      throw new AppException(ErrorCode.INSUFFICIENT_STOCK, 'Some items do not have enough stock', HttpStatus.CONFLICT, {
        details: {
          unavailable: short.map(({ variant, quantity }) => ({
            sku: variant.sku,
            requested: quantity,
            available: availability.find((entry) => entry.sku === variant.sku)?.available ?? 0,
          })),
        },
      });
    }

    const lines = [...merged.values()].map(({ variant, quantity }) => ({
      productId: variant.product.id,
      variantId: variant.id,
      sku: variant.sku,
      vendorId: variant.product.vendorId,
      vendorName: variant.product.vendorName,
      title: variant.product.title + (variant.title && variant.title !== 'Default' ? ` - ${variant.title}` : ''),
      imageUrl: variant.imageUrl ?? variant.product.media[0]?.url ?? null,
      options: variant.options,
      quantity,
      unitPrice: variant.price,
      unitMrp: variant.mrp,
      taxBps: variant.product.taxBps,
      lineTotal: variant.price * quantity,
    }));

    const totals = await this.priceCart(lines, 0, input.paymentMethod === 'COD');

    return {
      cartId: null,
      couponCode: null,
      lines,
      totals,
      basket: 'DIRECT' as const,
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

    // The cart screen is a preview: if catalog is briefly unreachable, show it priced
    // with the base settings rather than failing to show the cart at all. Quotes and
    // checkout never take this path - they always price with the live rules.
    const previewLines = enriched.map((item) => ({ productId: item.productId, quantity: item.quantity, lineTotal: item.lineTotal, taxBps: 0 }));
    const totals = await this.priceCart(previewLines, cart.couponDiscount, false).catch(() =>
      this.priceCart(previewLines, cart.couponDiscount, false, this.fallbackShipping()),
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

  /**
   * Order totals. Delivery comes from the admin-managed rules (store settings,
   * category and product rules) through the shared `computeShipping` calculator -
   * the same one the storefront's estimate uses, so preview and charge agree.
   */
  private async priceCart(
    lines: { productId: string; quantity: number; lineTotal: number; taxBps: number }[],
    couponDiscount: number,
    isCod: boolean,
    context?: ShippingContext,
  ) {
    const shippingContext = context ?? (await this.resolveShipping(lines.map((line) => line.productId)));
    const { settings } = shippingContext;
    if (isCod && !settings.codEnabled) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Cash on delivery is currently unavailable. Please pay online.', HttpStatus.BAD_REQUEST);
    }

    const itemTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discountTotal = Math.min(couponDiscount, itemTotal);
    const shipping = computeShipping(lines, discountTotal, shippingContext);

    // Weighted average tax rate across the lines, so a mixed basket is taxed correctly
    // without having to carry per-line tax through the totals object.
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
        shippingTotal: shipping.shippingTotal,
        taxBps: weightedBps,
        codFee: isCod ? settings.codFee : 0,
      }),
      /** Null when free delivery isn't on offer for this basket (threshold off, or only FREE/FIXED items). */
      freeShippingRemaining: shipping.freeShippingRemaining,
      shipping: {
        baseFee: shipping.baseFee,
        itemCharges: shipping.itemCharges,
        freeShippingThreshold: settings.freeShippingThreshold,
      },
    };
  }

  private resolveShipping(productIds: string[]): Promise<ShippingContext> {
    return rpc<ShippingContext>(
      this.catalog,
      CatalogPatterns.RESOLVE_SHIPPING,
      { productIds: [...new Set(productIds)] },
      { timeoutMs: this.rpcTimeout, service: 'catalog-service' },
    );
  }

  /** Cart-preview fallback only: env defaults, no per-item rules. */
  private fallbackShipping(): ShippingContext {
    return {
      settings: {
        baseFee: this.config.get<number>('business.defaultShippingFee', 4900),
        freeShippingThreshold: this.config.get<number>('business.freeShippingThreshold', 49900),
        codEnabled: true,
        codFee: this.config.get<number>('business.codFee', 2900),
      },
      rules: {},
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
