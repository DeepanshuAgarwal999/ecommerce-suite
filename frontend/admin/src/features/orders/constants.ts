import type { OrderStatus } from './types';

/** Mirrors CUSTOMER_CANCELLABLE in libs/contracts — statuses an order can still be cancelled from. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'PACKED'];
