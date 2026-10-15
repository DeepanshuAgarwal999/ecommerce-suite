/**
 * Kafka topic registry.
 *
 * Naming is `<domain>.<entity>.<past-tense-event>`. Topics are the public API between
 * services: once a topic is published to, its payload may only be extended, never
 * narrowed. Breaking changes get a new `.v2` topic and a migration window.
 *
 * Partitioning: every producer keys messages by the aggregate id (userId, orderId,
 * skuId). That keeps per-aggregate ordering intact while letting Kafka spread load
 * across partitions, which is what makes horizontal consumer scaling safe.
 */
export const KafkaTopics = {
  // --- auth ---------------------------------------------------------------
  OTP_REQUESTED: 'auth.otp.requested',
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged-in',
  USER_ROLES_CHANGED: 'auth.user.roles-changed',
  USER_BLOCKED: 'auth.user.blocked',

  // --- user / vendor ------------------------------------------------------
  USER_PROFILE_UPDATED: 'user.profile.updated',
  VENDOR_APPLIED: 'user.vendor.applied',
  VENDOR_APPROVED: 'user.vendor.approved',
  VENDOR_REJECTED: 'user.vendor.rejected',
  VENDOR_SUSPENDED: 'user.vendor.suspended',

  // --- catalog ------------------------------------------------------------
  PRODUCT_CREATED: 'catalog.product.created',
  PRODUCT_UPDATED: 'catalog.product.updated',
  PRODUCT_PUBLISHED: 'catalog.product.published',
  PRODUCT_ARCHIVED: 'catalog.product.archived',
  PRICE_CHANGED: 'catalog.price.changed',
  REVIEW_CREATED: 'catalog.review.created',

  // --- inventory ----------------------------------------------------------
  STOCK_RESERVE_REQUESTED: 'inventory.reserve.requested',
  STOCK_RESERVED: 'inventory.stock.reserved',
  STOCK_RESERVATION_FAILED: 'inventory.stock.reservation-failed',
  STOCK_RELEASE_REQUESTED: 'inventory.release.requested',
  STOCK_RELEASED: 'inventory.stock.released',
  STOCK_COMMITTED: 'inventory.stock.committed',
  STOCK_LEVEL_CHANGED: 'inventory.stock.level-changed',
  STOCK_LOW: 'inventory.stock.low',

  // --- cart ---------------------------------------------------------------
  CART_CHECKED_OUT: 'cart.checked-out',
  CART_ABANDONED: 'cart.abandoned',

  // --- order --------------------------------------------------------------
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_RETURN_REQUESTED: 'order.return.requested',

  // --- payment ------------------------------------------------------------
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_REQUESTED: 'payment.refund.requested',
  REFUND_PROCESSED: 'payment.refund.processed',

  // --- notification -------------------------------------------------------
  NOTIFICATION_REQUESTED: 'notification.requested',
  NOTIFICATION_SENT: 'notification.sent',
  DEVICE_TOKEN_REGISTERED: 'notification.device.registered',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];

export const ALL_TOPICS: KafkaTopic[] = Object.values(KafkaTopics);

/**
 * Retry/dead-letter naming. A consumer that fails a message N times republishes it to
 * `<topic>.retry`; once retries are exhausted it lands in `<topic>.dlq` where it stops
 * blocking the partition and can be replayed by an operator.
 */
export const retryTopic = (topic: string) => `${topic}.retry`;
export const dlqTopic = (topic: string) => `${topic}.dlq`;

/**
 * Consumer groups. One group per (service, concern) pair so that a slow consumer can be
 * scaled or paused without affecting the rest of that service.
 */
export const ConsumerGroups = {
  NOTIFICATION_DISPATCH: 'notification-service.dispatch',
  NOTIFICATION_LIFECYCLE: 'notification-service.lifecycle',
  ORDER_SAGA: 'order-service.saga',
  INVENTORY_SAGA: 'inventory-service.saga',
  PAYMENT_SAGA: 'payment-service.saga',
  CATALOG_PROJECTION: 'catalog-service.projection',
  USER_SYNC: 'user-service.sync',
  CART_SYNC: 'cart-service.sync',
  AUTH_ROLE_SYNC: 'auth-service.role-sync',
  RECOMMENDATION_LEARN: 'recommendation-service.learn',
} as const;

/**
 * Suggested partition counts. Sized from expected write throughput; a topic can be
 * grown later but never shrunk, so these start generous for the hot paths.
 */
export const TOPIC_PARTITIONS: Record<string, number> = {
  [KafkaTopics.OTP_REQUESTED]: 12,
  [KafkaTopics.ORDER_CREATED]: 24,
  [KafkaTopics.ORDER_STATUS_CHANGED]: 24,
  [KafkaTopics.PAYMENT_CAPTURED]: 12,
  [KafkaTopics.STOCK_RESERVE_REQUESTED]: 24,
  [KafkaTopics.STOCK_LEVEL_CHANGED]: 24,
  [KafkaTopics.NOTIFICATION_REQUESTED]: 24,
};

export const DEFAULT_PARTITIONS = 6;
export const DEFAULT_REPLICATION_FACTOR = 1;
