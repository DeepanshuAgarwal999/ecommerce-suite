import type { Provider } from '@nestjs/common';
import { MockPaymentProvider } from './mock/mock.provider';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { RazorpayProvider } from './razorpay/razorpay.provider';

/**
 * Every gateway adapter this service can use. Adding a gateway = add its class to
 * GATEWAY_ADAPTERS. (Registered ≠ active - PAYMENT_PROVIDER picks the active one.)
 */
const GATEWAY_ADAPTERS = [RazorpayProvider, MockPaymentProvider];

export const paymentProviders: Provider[] = [
  ...GATEWAY_ADAPTERS,
  {
    provide: PAYMENT_PROVIDERS,
    inject: GATEWAY_ADAPTERS,
    useFactory: (...adapters: PaymentProvider[]) => adapters,
  },
  PaymentProviderRegistry,
];
