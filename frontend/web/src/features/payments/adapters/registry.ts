import { mockAdapter } from './mock';
import { razorpayAdapter } from './razorpay';
import type { PaymentWidgetAdapter } from './types';

/**
 * Every gateway the storefront can open. Keys match payment-service adapter names
 * (`session.provider`). Adding a gateway = one entry here + its adapter file.
 */
const ADAPTERS: Record<string, PaymentWidgetAdapter> = {
  [razorpayAdapter.name]: razorpayAdapter,
  [mockAdapter.name]: mockAdapter,
};

export function getPaymentAdapter(provider: string): PaymentWidgetAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`This store's payment gateway (${provider}) isn't supported by this version of the site - please refresh.`);
  return adapter;
}
