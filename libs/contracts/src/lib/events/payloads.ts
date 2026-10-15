import { NotificationCategory, NotificationChannel, OtpPurpose } from '../enums/notification.enum';
import { OrderStatus, FulfilmentType } from '../enums/order.enum';
import { PaymentMethod, PaymentStatus } from '../enums/payment.enum';
import { Role } from '../enums/role.enum';
import { VendorStatus } from '../enums/catalog.enum';

// --- auth ------------------------------------------------------------------

export interface OtpRequestedPayload {
  mobile: string;
  countryCode: string;
  otp: string;
  purpose: OtpPurpose;
  expiresInSeconds: number;
  /** Android SMS Retriever hash so the app can auto-read the code. */
  appSignatureHash?: string;
}

export interface UserRegisteredPayload {
  userId: string;
  mobile: string;
  countryCode: string;
  email?: string;
  roles: Role[];
  referralCode?: string;
  registeredAt: string;
}

export interface UserLoggedInPayload {
  userId: string;
  sessionId: string;
  deviceId?: string;
  platform?: string;
  ip?: string;
}

export interface UserRolesChangedPayload {
  userId: string;
  roles: Role[];
  previousRoles: Role[];
  changedBy: string;
}

// --- user / vendor ---------------------------------------------------------

export interface VendorLifecyclePayload {
  vendorId: string;
  userId: string;
  businessName: string;
  status: VendorStatus;
  reason?: string;
  reviewedBy?: string;
}

// --- catalog ---------------------------------------------------------------

export interface ProductLifecyclePayload {
  productId: string;
  vendorId: string;
  slug: string;
  title: string;
  categoryId: string;
  status: string;
  variantIds: string[];
}

export interface PriceChangedPayload {
  productId: string;
  variantId: string;
  sku: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
}

// --- inventory -------------------------------------------------------------

export interface ReservationLineInput {
  sku: string;
  variantId: string;
  quantity: number;
  warehouseId?: string;
}

export interface StockReserveRequestedPayload {
  orderId: string;
  reservationId: string;
  userId: string;
  lines: ReservationLineInput[];
  /** Reservation self-destructs after this many seconds if payment never lands. */
  holdSeconds: number;
}

export interface StockReservedPayload {
  orderId: string;
  reservationId: string;
  lines: (ReservationLineInput & { warehouseId: string })[];
  expiresAt: string;
}

export interface StockReservationFailedPayload {
  orderId: string;
  reservationId: string;
  reason: string;
  unavailable: { sku: string; requested: number; available: number }[];
}

export interface StockLevelChangedPayload {
  sku: string;
  variantId: string;
  warehouseId: string;
  available: number;
  reserved: number;
}

// --- order -----------------------------------------------------------------

export interface OrderLinePayload {
  orderItemId: string;
  productId: string;
  variantId: string;
  sku: string;
  vendorId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  fulfilmentType: FulfilmentType;
  currency: string;
  itemTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  addressId: string;
  lines: OrderLinePayload[];
  placedAt: string;
  /** Channel the order was placed from, for attribution. */
  source?: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  previousStatus: OrderStatus;
  status: OrderStatus;
  reason?: string;
  changedBy?: string;
}

// --- payment ---------------------------------------------------------------

export interface PaymentLifecyclePayload {
  paymentId: string;
  orderId: string;
  userId: string;
  gateway: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  amount: number;
  currency: string;
  failureReason?: string;
}

export interface RefundLifecyclePayload {
  refundId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  gatewayRefundId?: string;
}

// --- notification ----------------------------------------------------------

export interface NotificationRequestedPayload {
  /** Target either a single user or a pre-computed audience segment. */
  userId?: string;
  userIds?: string[];
  segment?: string;
  channels: NotificationChannel[];
  category: NotificationCategory;
  templateKey: string;
  /** Values substituted into the template body. */
  variables?: Record<string, string | number>;
  /** Deep link the app opens when the notification is tapped. */
  deepLink?: string;
  imageUrl?: string;
  /** Collapses duplicates - a second request with the same key replaces the first. */
  dedupeKey?: string;
  /** Delay delivery until this ISO timestamp. */
  scheduledAt?: string;
}
