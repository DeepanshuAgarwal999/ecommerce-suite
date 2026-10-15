// See the note in role.enum.ts for why these are const objects rather than `enum`.

export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_PENDING: 'REFUND_PENDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  UPI: 'UPI',
  CARD: 'CARD',
  NETBANKING: 'NETBANKING',
  WALLET: 'WALLET',
  EMI: 'EMI',
  PAY_LATER: 'PAY_LATER',
  COD: 'COD',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentGateway = {
  RAZORPAY: 'RAZORPAY',
  COD: 'COD',
} as const;

export type PaymentGateway = (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const RefundStatus = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

/**
 * Razorpay transacts in the smallest currency unit, so every amount crossing the gateway
 * boundary is an integer number of paise. Money is stored the same way internally to keep
 * floating-point rounding out of the domain entirely.
 */
export const CURRENCY_MINOR_UNIT_FACTOR = 100;

export const DEFAULT_CURRENCY = 'INR';

/** Razorpay's own event names, as they arrive on the webhook. */
export const RazorpayWebhookEvents = {
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  ORDER_PAID: 'order.paid',
  REFUND_CREATED: 'refund.created',
  REFUND_PROCESSED: 'refund.processed',
  REFUND_FAILED: 'refund.failed',
} as const;

export type RazorpayWebhookEvent =
  (typeof RazorpayWebhookEvents)[keyof typeof RazorpayWebhookEvents];
