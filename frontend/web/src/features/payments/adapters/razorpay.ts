import type { PaymentWidgetAdapter, WidgetInput, WidgetResult } from './types';

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads Razorpay Checkout once per page; concurrent callers share the same load. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay needs a browser'));
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next attempt
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Razorpay Checkout (checkout.js). The backend's clientConfig is already the exact
 * options object Razorpay expects (key, order_id, amount, prefill...); we only add the
 * callbacks and theme.
 *
 * Razorpay lets the shopper retry inside its own modal after a decline (card declined,
 * try UPI), so `payment.failed` doesn't end anything here - only success (handler) or
 * the shopper closing the modal (ondismiss) settles the promise.
 */
export const razorpayAdapter: PaymentWidgetAdapter = {
  name: 'razorpay',
  label: 'Secured by Razorpay',
  preload: loadScript,

  async open({ clientConfig, brandColor }: WidgetInput): Promise<WidgetResult> {
    await loadScript();
    const Razorpay = window.Razorpay;
    if (!Razorpay) throw new Error('The payment window is unavailable right now.');

    return new Promise<WidgetResult>((resolve) => {
      const instance = new Razorpay({
        ...clientConfig,
        theme: { color: brandColor },
        retry: { enabled: true },
        // Razorpay's checkout returns these three fields; payment-service's Razorpay
        // adapter verifies the signature.
        handler: (response: Record<string, unknown>) => resolve({ kind: 'completed', gatewayResponse: response }),
        modal: {
          ondismiss: () => resolve({ kind: 'dismissed' }),
          confirm_close: true,
          escape: true,
        },
      });
      instance.on('payment.failed', () => {
        // Shown inside Razorpay's modal, which offers a retry; nothing to do here.
      });
      instance.open();
    });
  },
};
