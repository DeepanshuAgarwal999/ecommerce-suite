import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, Roles } from '@ecommerce/auth';
import {
  CartPatterns,
  CatalogPatterns,
  InventoryPatterns,
  OrderPatterns,
  Permission,
  RecommendationPatterns,
  Role,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';
import { assessProductHealth } from './product-health';

interface ProductMeta {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  ratingAverage: number;
  ratingCount: number;
  category?: { id: string; name: string } | null;
}

interface Activity {
  categoryId: string | null;
  monthly: { month: string; views: number; viewers: number; carts: number; wishlists: number }[];
  last90: { views: number; viewers: number; carts: number; cartUsers: number; wishlists: number };
  momentum: { viewsLast30: number; viewsPrev30: number };
  allTime: { views: number; carts: number; wishlists: number; purchases: number; trackingSince: string | null };
  benchmark: {
    productsCompared: number;
    avgViews: number | null;
    viewToCartRate: number | null;
    viewToOrderRate: number | null;
    viewsRank: number | null;
    productsInCategory: number;
  } | null;
}

interface Sales {
  monthly: { month: string; orders: number; units: number; revenue: number; cancelledUnits: number; returnedUnits: number }[];
  last90: { orders: number; units: number; revenue: number; cancelledUnits: number; returnedUnits: number; buyers: number };
  lifetime: { buyers: number; repeatBuyers: number; firstSaleAt: string | null; lastSaleAt: string | null };
}

interface Wishlist {
  monthly: { month: string; saves: number }[];
  savedNow: number;
}

interface Stock {
  onHand: number;
  reserved: number;
  available: number;
  skus: number;
}

/** A panel's data, or why it is missing - one service down must not blank the page. */
async function panel<T>(promise: Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unavailable' };
  }
}

/** The last `months` calendar months in India time, oldest first: ['2026-05', ...]. */
function monthKeys(months: number): string[] {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

/**
 * Product life stats for the admin product page: a monthly series (views, add to
 * carts, wishlist saves, orders, units, revenue, cancellations, returns), the funnel,
 * category benchmarks, stock cover, and a "worth listing?" scorecard
 * (see product-health.ts). Each figure comes from the service that owns it.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@RequirePermissions(Permission.CATALOG_READ)
@Controller('admin')
export class ProductInsightsController {
  constructor(private readonly gateway: GatewayService) {}

  @Get('products/:productId/insights')
  @ApiOperation({ summary: 'Monthly performance, funnel, benchmarks and a listing-health verdict for one product' })
  async insights(@Param('productId', ParseUUIDPipe) productId: string, @Query('months') monthsRaw?: string) {
    const months = [3, 6, 12].includes(Number(monthsRaw)) ? Number(monthsRaw) : 6;

    const [product, activity, sales, wishlist, stock] = await Promise.all([
      this.gateway.catalog<ProductMeta>(CatalogPatterns.GET_PRODUCT, { productId, includeUnpublished: true }),
      panel(this.gateway.recommendation<Activity>(RecommendationPatterns.PRODUCT_ACTIVITY, { productId, months })),
      panel(this.gateway.order<Sales>(OrderPatterns.ADMIN_PRODUCT_SALES, { productId, months })),
      panel(this.gateway.cart<Wishlist>(CartPatterns.ADMIN_PRODUCT_WISHLIST, { productId, months })),
      panel(this.gateway.inventory<Stock>(InventoryPatterns.PRODUCT_STOCK, { productId })),
    ]);

    // One row per month, every source merged, gaps filled with zeros.
    const monthly = monthKeys(months).map((month) => {
      const a = activity.ok ? activity.data.monthly.find((row) => row.month === month) : undefined;
      const s = sales.ok ? sales.data.monthly.find((row) => row.month === month) : undefined;
      const w = wishlist.ok ? wishlist.data.monthly.find((row) => row.month === month) : undefined;
      const views = a?.views ?? 0;
      const orders = s?.orders ?? 0;
      return {
        month,
        views,
        viewers: a?.viewers ?? 0,
        carts: a?.carts ?? 0,
        wishlistSaves: w?.saves ?? 0,
        orders,
        units: s?.units ?? 0,
        revenue: s?.revenue ?? 0,
        cancelledUnits: s?.cancelledUnits ?? 0,
        returnedUnits: s?.returnedUnits ?? 0,
        conversionRate: views > 0 ? orders / views : null,
      };
    });

    const listedAt = product.publishedAt ?? product.createdAt;
    const ageDays = (Date.now() - new Date(listedAt).getTime()) / 86_400_000;

    const health = assessProductHealth({
      ageDays,
      views90: activity.ok ? activity.data.last90.views : 0,
      carts90: activity.ok ? activity.data.last90.carts : 0,
      orders90: sales.ok ? sales.data.last90.orders : 0,
      units90: sales.ok ? sales.data.last90.units : 0,
      returnedUnits90: sales.ok ? sales.data.last90.returnedUnits : 0,
      cancelledUnits90: sales.ok ? sales.data.last90.cancelledUnits : 0,
      viewsLast30: activity.ok ? activity.data.momentum.viewsLast30 : 0,
      viewsPrev30: activity.ok ? activity.data.momentum.viewsPrev30 : 0,
      allTimeViews: activity.ok ? activity.data.allTime.views : 0,
      ratingAverage: product.ratingAverage,
      ratingCount: product.ratingCount,
      stockAvailable: stock.ok ? stock.data.available : null,
      benchmark: activity.ok ? activity.data.benchmark : null,
    });

    return {
      productId,
      months,
      generatedAt: new Date().toISOString(),
      listedAt,
      ageDays: Math.floor(ageDays),
      monthly,
      funnel90: {
        views: activity.ok ? activity.data.last90.views : null,
        viewers: activity.ok ? activity.data.last90.viewers : null,
        carts: activity.ok ? activity.data.last90.carts : null,
        wishlists: activity.ok ? activity.data.last90.wishlists : null,
        orders: sales.ok ? sales.data.last90.orders : null,
        units: sales.ok ? sales.data.last90.units : null,
        revenue: sales.ok ? sales.data.last90.revenue : null,
        buyers: sales.ok ? sales.data.last90.buyers : null,
      },
      lifetime: {
        views: activity.ok ? activity.data.allTime.views : null,
        trackingSince: activity.ok ? activity.data.allTime.trackingSince : null,
        buyers: sales.ok ? sales.data.lifetime.buyers : null,
        repeatBuyers: sales.ok ? sales.data.lifetime.repeatBuyers : null,
        firstSaleAt: sales.ok ? sales.data.lifetime.firstSaleAt : null,
        lastSaleAt: sales.ok ? sales.data.lifetime.lastSaleAt : null,
        savedNow: wishlist.ok ? wishlist.data.savedNow : null,
      },
      category: {
        name: product.category?.name ?? null,
        benchmark: activity.ok ? activity.data.benchmark : null,
      },
      stock: stock.ok ? stock.data : null,
      health,
      unavailable: [
        ...(activity.ok ? [] : [`engagement (${activity.error})`]),
        ...(sales.ok ? [] : [`sales (${sales.error})`]),
        ...(wishlist.ok ? [] : [`wishlist (${wishlist.error})`]),
        ...(stock.ok ? [] : [`stock (${stock.error})`]),
      ],
    };
  }
}
