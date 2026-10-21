import { api, endpoints } from '@/lib/api';
import type { CheckoutItemInput, OrderQuote, PaymentSession, PaymentStatusView, PlacedOrder } from '../types';

export const paymentsApi = {
  /** Which gateway is active - for the option label and SDK preloading. */
  config: () => api.get<{ provider: string }>(endpoints.payments.config),

  quote: (input: { paymentMethod: string; pincode?: string; items: CheckoutItemInput[] }) =>
    api.post<OrderQuote>(endpoints.orders.quote, input),

  /** `idempotencyKey` makes a retried "Pay" return the same order, never a second one. */
  placeOrder: (
    input: { addressId: string; paymentMethod: string; pincode?: string; items: CheckoutItemInput[] },
    idempotencyKey: string,
  ) => api.post<PlacedOrder>(endpoints.orders.list, input, { headers: { 'Idempotency-Key': idempotencyKey } }),

  getOrder: (orderId: string) => api.get<PlacedOrder & Record<string, unknown>>(endpoints.orders.detail(orderId)),

  startPayment: (orderId: string) => api.post<PaymentSession>(endpoints.payments.checkout, { orderId }),

  confirm: (paymentId: string, gatewayResponse: Record<string, unknown>) =>
    api.post<PaymentStatusView>(endpoints.payments.confirm, { paymentId, gatewayResponse }),

  getPayment: (paymentId: string) => api.get<PaymentStatusView>(endpoints.payments.detail(paymentId)),
};
