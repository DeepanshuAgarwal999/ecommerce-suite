// See the note in role.enum.ts for why these are const objects rather than `enum`.

/**
 * Order lifecycle. Transitions are driven by the saga in order-service; the shape is
 * shared so other services can reason about an order without an RPC round trip.
 */
export const OrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CONFIRMED: 'CONFIRMED',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURN_APPROVED: 'RETURN_APPROVED',
  RETURNED: 'RETURNED',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Statuses a customer can still cancel from without going through a return. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
  OrderStatus.REFUNDED,
];

/**
 * Allowed transitions. Centralising them means an invalid jump - say, DELIVERED back to
 * PACKED - is rejected identically whether it came from an admin action, a courier
 * webhook or a saga compensation.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.CONFIRMED,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURN_APPROVED, OrderStatus.DELIVERED],
  [OrderStatus.RETURN_APPROVED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  (ORDER_TRANSITIONS[from] ?? []).includes(to);

export const OrderItemStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
} as const;

export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];

export const FulfilmentType = {
  /** Warehouse-shipped, multi-day delivery (Meesho / Vaaree style). */
  STANDARD: 'STANDARD',
  /** Dark-store dispatch with a minutes-level SLA (Blinkit style). */
  QUICK_COMMERCE: 'QUICK_COMMERCE',
  SCHEDULED: 'SCHEDULED',
} as const;

export type FulfilmentType = (typeof FulfilmentType)[keyof typeof FulfilmentType];

/** State of the distributed checkout saga owned by order-service. */
export const SagaStatus = {
  STARTED: 'STARTED',
  AWAITING_INVENTORY: 'AWAITING_INVENTORY',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  COMPLETED: 'COMPLETED',
  COMPENSATING: 'COMPENSATING',
  COMPENSATED: 'COMPENSATED',
  FAILED: 'FAILED',
} as const;

export type SagaStatus = (typeof SagaStatus)[keyof typeof SagaStatus];
