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

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  vendorId: string;
  vendorName: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  userId: string;
  userMobile: string;
  status: OrderStatus;
  fulfilmentType: string;
  source: string;
  grandTotal: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  items: Pick<OrderItem, 'title' | 'imageUrl' | 'quantity' | 'sku'>[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface OrderDetail extends Omit<OrderListItem, 'items'> {
  itemTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  codFee: number;
  couponCode: string | null;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  cancelledAt: string | null;
  cancellationReason: string | null;
  deliveredAt: string | null;
  notes: string | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
}
