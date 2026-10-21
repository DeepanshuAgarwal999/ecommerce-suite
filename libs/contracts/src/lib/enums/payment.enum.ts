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
  /** Order-level: "pay online via the gateway" - the instrument is chosen in the gateway widget. */
  ONLINE: 'ONLINE',
  UPI: 'UPI',
  CARD: 'CARD',
  NETBANKING: 'NETBANKING',
  WALLET: 'WALLET',
  EMI: 'EMI',
  PAY_LATER: 'PAY_LATER',
  COD: 'COD',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/**
 * Which gateway processed a payment. Adding a gateway = one entry here, one in the
 * payment-service Prisma enum, and one adapter class (see payment-service
 * `providers/`). COD is "no gateway"; MOCK is a dev-only stand-in that is refused
 * in production.
 */
export const PaymentGateway = {
  RAZORPAY: 'RAZORPAY',
  COD: 'COD',
  MOCK: 'MOCK',
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
