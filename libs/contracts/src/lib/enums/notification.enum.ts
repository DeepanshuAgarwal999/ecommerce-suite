// See the note in role.enum.ts for why these are const objects rather than `enum`.

export const NotificationChannel = {
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationCategory = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  PROMOTIONAL: 'PROMOTIONAL',
  ACCOUNT: 'ACCOUNT',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

/**
 * Categories a user may never opt out of. "Your payment failed" and "your OTP" are not
 * marketing, and suppressing them would break the product rather than respect a
 * preference.
 */
export const NON_OPTOUT_CATEGORIES: readonly NotificationCategory[] = [
  NotificationCategory.TRANSACTIONAL,
  NotificationCategory.PAYMENT,
  NotificationCategory.ACCOUNT,
];

export const NotificationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  /** Dropped on purpose - user preferences or quiet hours said no. */
  SUPPRESSED: 'SUPPRESSED',
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const DevicePlatform = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WEB: 'WEB',
} as const;

export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const OtpPurpose = {
  LOGIN: 'LOGIN',
  SIGNUP: 'SIGNUP',
  MOBILE_CHANGE: 'MOBILE_CHANGE',
  EMAIL_VERIFY: 'EMAIL_VERIFY',
  RESET_MPIN: 'RESET_MPIN',
} as const;

export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

/** Template keys, referenced by producers so a typo fails at compile time. */
export const TemplateKeys = {
  OTP_LOGIN: 'otp.login',
  WELCOME: 'account.welcome',
  ORDER_PLACED: 'order.placed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_OUT_FOR_DELIVERY: 'order.out-for-delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_PROCESSED: 'refund.processed',
  VENDOR_APPROVED: 'vendor.approved',
  VENDOR_REJECTED: 'vendor.rejected',
  BACK_IN_STOCK: 'catalog.back-in-stock',
  PRICE_DROP: 'catalog.price-drop',
  CART_ABANDONED: 'cart.abandoned',
  SUPPORT_TICKET_CREATED: 'support.ticket-created',
  SUPPORT_AGENT_REPLY: 'support.agent-reply',
  SUPPORT_TICKET_RESOLVED: 'support.ticket-resolved',
} as const;

export type TemplateKey = (typeof TemplateKeys)[keyof typeof TemplateKeys];
