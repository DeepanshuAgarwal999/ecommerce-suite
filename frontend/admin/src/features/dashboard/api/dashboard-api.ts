import { format } from 'date-fns';
import { inventoryApi } from '@/features/inventory/api/inventory-api';
import { ordersApi } from '@/features/orders/api/orders-api';
import { productsApi } from '@/features/products/api/products-api';
import { vendorsApi } from '@/features/vendors/api/vendors-api';

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardOverview {
  vendors: { total: number; byStatus: StatusCount[] };
  products: { total: number; byStatus: StatusCount[] };
  orders: { total: number; byStatus: StatusCount[] };
  lowStockCount: number;
}

export interface OrderTrendPoint {
  date: string;
  label: string;
  orders: number;
}

function sumCounts(rows: { status: string; count: number }[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

function pick(rows: { status: string; count: number }[], label: string, status: string): StatusCount {
  return { status: label, count: rows.find((row) => row.status === status)?.count ?? 0 };
}

/**
 * Four requests, not ~30. This used to read every number off `meta.total` of
 * an existing paginated list endpoint — one `limit=1` call per status, plus
 * one per day for the trend line. That fired roughly 30 parallel requests on
 * every single dashboard load (doubled again by React Strict Mode in dev),
 * which is exactly what tripped the gateway's rate limiter in practice. Each
 * entity now has a `summary()` (grouped count by status, one query) and
 * orders has a `trend()` (grouped count by day, one query) — see
 * ProductService.adminSummary / VendorService.summary / OrderService.summary
 * /trend in the backend, each cached server-side for 30s too.
 */
export const dashboardApi = {
  async overview(): Promise<DashboardOverview> {
    const [vendors, products, orders, lowStock] = await Promise.all([
      vendorsApi.summary(),
      productsApi.summary(),
      ordersApi.summary(),
      inventoryApi.lowStock(),
    ]);

    return {
      vendors: {
        total: sumCounts(vendors),
        byStatus: [
          pick(vendors, 'Pending', 'PENDING'),
          pick(vendors, 'Approved', 'APPROVED'),
          pick(vendors, 'Rejected', 'REJECTED'),
          pick(vendors, 'Suspended', 'SUSPENDED'),
        ],
      },
      products: {
        total: sumCounts(products),
        byStatus: [
          pick(products, 'Pending review', 'PENDING_REVIEW'),
          pick(products, 'Active', 'ACTIVE'),
          pick(products, 'Rejected', 'REJECTED'),
        ],
      },
      orders: {
        total: sumCounts(orders),
        byStatus: [
          pick(orders, 'Pending payment', 'PENDING_PAYMENT'),
          pick(orders, 'Confirmed', 'CONFIRMED'),
          pick(orders, 'Shipped', 'SHIPPED'),
          pick(orders, 'Delivered', 'DELIVERED'),
          pick(orders, 'Cancelled', 'CANCELLED'),
        ],
      },
      lowStockCount: lowStock.length,
    };
  },

  /** Order count per day for the trailing `days` days, oldest first. */
  async orderTrend(days: number): Promise<OrderTrendPoint[]> {
    const rows = await ordersApi.trend(days);
    return rows.map((row) => ({
      date: row.date,
      label: format(new Date(row.date), 'd MMM'),
      orders: row.orders,
    }));
  },
};
