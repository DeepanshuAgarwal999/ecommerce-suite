import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, Roles } from '@ecommerce/auth';
import {
  CartPatterns,
  CatalogPatterns,
  InsightsQueryDto,
  OrderPatterns,
  Permission,
  Role,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

interface Engagement {
  totals: { views: number; searches: number; zeroSearches: number };
  series: { date: string; views: number; searches: number; zeroSearches: number }[];
  topSearches: { term: string; count: number }[];
  zeroResultSearches: { term: string; count: number }[];
  topViewed: {
    productId: string;
    title: string;
    slug: string;
    status: string;
    price: number;
    imageUrl: string | null;
    views: number;
  }[];
}

interface ProductSales {
  productId: string;
  title: string;
  imageUrl: string | null;
  units: number;
  orders: number;
  revenue: number;
}

interface TopProducts {
  totals: { orders: number; units: number; revenue: number };
  top: ProductSales[];
  byProduct: ProductSales[];
}

interface TopWishlisted {
  totals: { saves: number; recent: number };
  top: { productId: string; title: string; imageUrl: string | null; saves: number; recent: number }[];
}

/** A panel's data, or why it is missing - one service down must not blank the whole page. */
type Panel<T> = { ok: true; data: T } | { ok: false; error: string };

async function panel<T>(promise: Promise<T>): Promise<Panel<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unavailable' };
  }
}

/**
 * Store performance insights for the admin console: what shoppers search for
 * (and fail to find), what they look at, save and buy - over 1/7/30/90 days.
 *
 * Each metric lives with the service that owns it (engagement counters in
 * catalog-service, sales in order-service, wishlists in cart-service); this
 * route only fans out and stitches. The most-viewed products are passed to
 * order-service so each gets its view -> order conversion - the "lots of
 * interest, few sales" signal is usually the most actionable thing on the page.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@RequirePermissions(Permission.ORDER_READ_ANY)
@Controller('admin')
export class InsightsAdminController {
  constructor(private readonly gateway: GatewayService) {}

  @Get('insights')
  @ApiOperation({ summary: 'Top searches, zero-result searches, most viewed / ordered / wishlisted products' })
  async insights(@Query() { days }: InsightsQueryDto) {
    const [engagement, wishlist] = await Promise.all([
      panel(this.gateway.catalog<Engagement>(CatalogPatterns.ADMIN_ENGAGEMENT_INSIGHTS, { days })),
      panel(this.gateway.cart<TopWishlisted>(CartPatterns.ADMIN_TOP_WISHLISTED, { days })),
    ]);

    const viewedIds = engagement.ok ? engagement.data.topViewed.map((row) => row.productId) : [];
    const sales = await panel(
      this.gateway.order<TopProducts>(OrderPatterns.ADMIN_TOP_PRODUCTS, { days, productIds: viewedIds }),
    );

    // Join views with sales for the most-viewed list: orders per 100 views.
    const salesById = new Map(sales.ok ? sales.data.byProduct.map((row) => [row.productId, row]) : []);
    const engagementPanel: Panel<Engagement & { topViewed: (Engagement['topViewed'][number] & {
      orders: number | null;
      units: number | null;
      conversion: number | null;
    })[] }> = engagement.ok
      ? {
          ok: true,
          data: {
            ...engagement.data,
            topViewed: engagement.data.topViewed.map((row) => {
              const sold = salesById.get(row.productId);
              const orders = sales.ok ? (sold?.orders ?? 0) : null;
              return {
                ...row,
                orders,
                units: sales.ok ? (sold?.units ?? 0) : null,
                conversion: orders === null || row.views === 0 ? null : (orders / row.views) * 100,
              };
            }),
          },
        }
      : engagement;

    return {
      days,
      generatedAt: new Date().toISOString(),
      engagement: engagementPanel,
      sales: sales.ok ? { ok: true as const, data: { totals: sales.data.totals, top: sales.data.top } } : sales,
      wishlist,
    };
  }
}
