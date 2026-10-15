import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types';
import type { OrderStatus, VendorOrder } from '../types';

export interface VendorOrdersQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

/** Mirrors apps/api-gateway vendor.controller's order routes. */
export const ordersApi = {
  list: (query: VendorOrdersQuery) =>
    api.get<Paginated<VendorOrder>>(endpoints.vendor.orders, { searchParams: { ...query } }),

  /** Vendors may only set PACKED or SHIPPED — see VENDOR_SETTABLE_STATUSES. */
  updateStatus: (orderId: string, status: OrderStatus) =>
    api.post<{ ok: boolean }>(endpoints.vendor.orderStatus(orderId), { status }),
};
