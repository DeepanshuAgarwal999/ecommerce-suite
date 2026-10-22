import { create } from 'zustand';

/**
 * App side of the gateway abstraction - the twin of payment-service's
 * PaymentProvider and of the web's features/payments/adapters. The checkout
 * never imports a gateway SDK; the backend names the adapter (`session.provider`)
 * and the adapter renders its own widget inside <PaymentWidgetHost />.
 *
 * Adding a gateway: add its name to KNOWN_PROVIDERS, a label, and a widget
 * component in components/payment-widget-host.tsx.
 */
export type WidgetResult =
  /** The widget reports a completed payment - send `gatewayResponse` to /payments/confirm. */
  | { kind: 'completed'; gatewayResponse: Record<string, unknown> }
  /** The gateway reported a decline it won't retry inside its own widget. */
  | { kind: 'failed'; gatewayResponse?: Record<string, unknown>; message: string }
  /** Shopper closed the widget without paying. */
  | { kind: 'dismissed' };

interface PendingWidget {
  provider: string;
  clientConfig: Record<string, unknown>;
  brandColor?: string;
  resolve: (result: WidgetResult) => void;
}

interface WidgetState {
  pending: PendingWidget | null;
  open: (widget: PendingWidget) => void;
  settle: (result: WidgetResult) => void;
}

export const usePaymentWidget = create<WidgetState>((set, get) => ({
  pending: null,
  open: (pending) => set({ pending }),
  settle: (result) => {
    get().pending?.resolve(result);
    set({ pending: null });
  },
}));

const KNOWN_PROVIDERS = new Set(['razorpay', 'mock']);

export const PROVIDER_LABELS: Record<string, string> = {
  razorpay: 'UPI, cards, netbanking & wallets · Secured by Razorpay',
  mock: 'Test mode - no real money',
};

/** Opens the named gateway's widget and resolves when the shopper finishes or closes it. */
export function openPaymentWidget(provider: string, clientConfig: Record<string, unknown>, brandColor?: string): Promise<WidgetResult> {
  if (!KNOWN_PROVIDERS.has(provider)) {
    return Promise.reject(new Error('This payment method needs a newer version of the app. Please update.'));
  }
  return new Promise((resolve) => usePaymentWidget.getState().open({ provider, clientConfig, brandColor, resolve }));
}
