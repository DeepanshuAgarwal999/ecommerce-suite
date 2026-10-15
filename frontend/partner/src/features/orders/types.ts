/** Mirrors OrderStatus in libs/contracts/enums/order.enum.ts. */
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

/** The only transitions a vendor is allowed to make (see vendor.controller.ts). */
export const VENDOR_SETTABLE_STATUSES: OrderStatus[] = ['PACKED', 'SHIPPED'];

export interface OrderLineItem {
  id: string;
  title: string;
  imageUrl: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  options: Record<string, string> | null;
}

/** Loosely typed — Order.shippingAddress is an untyped JSON column on the backend. */
export interface ShippingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  [key: string]: unknown;
}

/** A row from GET /vendor/orders — only this vendor's items are included. */
export interface VendorOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  shippingAddress: ShippingAddress;
  items: OrderLineItem[];
}
