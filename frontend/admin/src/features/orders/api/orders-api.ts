import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types/pagination';
import type { OrderDetail, OrderListItem, OrderListQuery, OrderStatus } from '../types';

export const ordersApi = {
  list: (query: OrderListQuery) =>
    api.get<Paginated<OrderListItem>>(endpoints.admin.orders, { searchParams: { ...query } }),

  get: (orderId: string) => api.get<OrderDetail>(endpoints.admin.order(orderId)),

  updateStatus: (orderId: string, status: OrderStatus, reason?: string) =>
    api.post<OrderDetail>(endpoints.admin.orderStatus(orderId), { status, reason }),

  cancel: (orderId: string, reason: string) =>
    api.post<OrderDetail>(endpoints.admin.orderCancel(orderId), { reason }),

  count: (status?: OrderStatus, range?: { from?: string; to?: string }) =>
    api
      .get<Paginated<OrderListItem>>(endpoints.admin.orders, {
        searchParams: { status, limit: 1, ...range },
      })
      .then((result) => result.meta.total),

  /** Every status's count in one request — what the dashboard actually wants,
   *  instead of calling `count()` once per status. */
  summary: () => api.get<{ status: OrderStatus; count: number }[]>(endpoints.admin.ordersSummary),

  /** Order count per day for the trailing `days` days, oldest first, in one
   *  request — instead of one `count()` call per day. */
  trend: (days: number) =>
    api.get<{ date: string; orders: number }[]>(endpoints.admin.ordersTrend, {
      searchParams: { days },
    }),
};
