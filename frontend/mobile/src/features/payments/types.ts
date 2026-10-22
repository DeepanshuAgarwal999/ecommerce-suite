/** What the shopper picks in the payment step. Online = whatever the active gateway offers (UPI, cards, netbanking, wallets). */
export type PaymentChoice = 'ONLINE' | 'COD';

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

/** POST /orders/quote - the exact amount that will be charged. */
export interface OrderQuote {
  lines: {
    productId: string;
    variantId: string;
    title: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    unitMrp: number;
    lineTotal: number;
  }[];
  totals: {
    itemTotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    codFee: number;
    grandTotal: number;
  };
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  paymentMethod: string;
}

/**
 * POST /payments/checkout. `provider` names the client adapter to use; `clientConfig`
 * is opaque to everything except that adapter (features/payments/adapters).
 */
export interface PaymentSession {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: string;
  clientConfig: Record<string, unknown>;
}

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface PaymentStatusView {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  status: PaymentStatus;
  method: string | null;
  amount: number;
  failureReason: string | null;
}
