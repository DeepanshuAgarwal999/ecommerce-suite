import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { useIsSignedIn } from '@/features/auth/session';
import { api, endpoints, errorMessage, queryKeys } from '@/lib/api';
import type { Paginated } from '@/types';

/** libs/contracts OrderStatus. */
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURNED'
  | 'REFUNDED';

/** Mirrors CUSTOMER_CANCELLABLE in libs/contracts - the server enforces it too. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'PACKED'];

/** GET /orders - order-service listForUser (items trimmed to title/image/qty/sku). */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  paymentMethod: string;
  createdAt: string;
  items: { title: string; imageUrl: string | null; quantity: number; sku: string }[];
}

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  vendorName: string;
  quantity: number;
  unitPrice: number;
  unitMrp: number;
  lineTotal: number;
  /** This line's share of the order discount - the refund is lineTotal - discount, pro rata. */
  discount: number;
  status: string;
}

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED';

export interface ReturnRequestView {
  id: string;
  reason: string;
  description: string | null;
  status: ReturnStatus;
  refundAmount: number;
  createdAt: string;
  items: { orderItemId: string; quantity: number; amount: number }[];
}

export interface RequestReturnInput {
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  description?: string;
}

/** order-service ReturnService: delivered orders only, 7-day platform window. */
export const RETURN_WINDOW_DAYS = 7;

export const RETURN_STATUS_META: Record<ReturnStatus, { label: string; detail: string; tone: 'warning' | 'primary' | 'destructive' | 'success' }> = {
  REQUESTED: { label: 'Return requested', detail: 'We’re reviewing your request - usually within 24 hours.', tone: 'warning' },
  APPROVED: { label: 'Pickup scheduled', detail: 'A courier will collect the items. Keep them packed.', tone: 'primary' },
  REJECTED: { label: 'Return declined', detail: 'This return didn’t meet the policy. Contact support for help.', tone: 'destructive' },
  RECEIVED: { label: 'Refund initiated', detail: 'Items received. The refund reaches your source in 5-7 business days.', tone: 'success' },
};

export interface OrderDetail extends Omit<OrderSummary, 'items'> {
  itemTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  codFee: number;
  paidAt: string | null;
  deliveredAt: string | null;
  returns: ReturnRequestView[];
  shippingAddress: {
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    landmark?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: OrderItem[];
  statusHistory: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; reason: string | null; createdAt: string }[];
  shipments: { id: string; courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; status: string }[];
}

export const ordersApi = {
  list: (page: number) => api.get<Paginated<OrderSummary>>(endpoints.orders.list, { searchParams: { page, limit: 15 } }),
  detail: (id: string) => api.get<OrderDetail>(endpoints.orders.detail(id)),
  cancel: (id: string, reason: string) => api.post<OrderDetail>(endpoints.orders.cancel(id), { reason }),
  requestReturn: (id: string, input: RequestReturnInput) => api.post<ReturnRequestView>(endpoints.orders.returns(id), input),
};

/**
 * What can still be returned per line: bought minus already in a live (non-rejected)
 * return. Mirrors the server's check so the UI never offers a quantity it would refuse.
 */
export function returnableQuantities(order: OrderDetail): Map<string, number> {
  const used = new Map<string, number>();
  for (const request of order.returns ?? []) {
    if (request.status === 'REJECTED') continue;
    for (const line of request.items) used.set(line.orderItemId, (used.get(line.orderItemId) ?? 0) + line.quantity);
  }
  return new Map(order.items.map((item) => [item.id, Math.max(0, item.quantity - (used.get(item.id) ?? 0))]));
}

/** Days left in the return window, or null when not returnable (not delivered / closed). */
export function returnDaysLeft(order: Pick<OrderDetail, 'status' | 'deliveredAt'>, now = Date.now()): number | null {
  if (order.status !== 'DELIVERED') return null;
  if (!order.deliveredAt) return RETURN_WINDOW_DAYS;
  const left = Math.ceil((new Date(order.deliveredAt).getTime() + RETURN_WINDOW_DAYS * 86_400_000 - now) / 86_400_000);
  return left > 0 ? left : null;
}

export function useRequestReturn(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestReturnInput) => ordersApi.requestReturn(id, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.orders.all }),
    onError: (error) => toast.error(errorMessage(error, 'Could not request the return.')),
  });
}

export function useOrders() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: ({ pageParam }) => ordersApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    enabled: signedIn,
    staleTime: 30_000,
  });
}

/** Polls every 20 s while the order is moving (not terminal), so the timeline advances live. */
export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.detail(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'PAYMENT_FAILED'].includes(status) ? 20_000 : false;
    },
  });
}

export function useCancelOrder(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Order cancelled. Any payment will be refunded to the source.');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not cancel this order.')),
  });
}

/** Shopper-facing status copy + tone. */
export const STATUS_META: Record<OrderStatus, { label: string; tone: 'success' | 'primary' | 'warning' | 'destructive' | 'mutedForeground' }> = {
  DRAFT: { label: 'Processing', tone: 'mutedForeground' },
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning' },
  PAYMENT_FAILED: { label: 'Payment failed', tone: 'destructive' },
  CONFIRMED: { label: 'Confirmed', tone: 'primary' },
  PACKED: { label: 'Packed', tone: 'primary' },
  SHIPPED: { label: 'Shipped', tone: 'primary' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'primary' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'destructive' },
  RETURN_REQUESTED: { label: 'Return requested', tone: 'warning' },
  RETURN_APPROVED: { label: 'Return approved', tone: 'warning' },
  RETURNED: { label: 'Returned', tone: 'mutedForeground' },
  REFUNDED: { label: 'Refunded', tone: 'success' },
};

/** The happy path the tracker draws; off-path states (cancelled, returns) show as a final node. */
export const TRACK_STEPS: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
