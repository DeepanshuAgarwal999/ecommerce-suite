/**
 * Storefront side of the gateway abstraction - the twin of payment-service's
 * PaymentProvider. Each gateway gets one adapter that knows how to open its checkout
 * widget from the backend's opaque `clientConfig` and report what happened. The
 * checkout page never imports a gateway SDK; it asks the registry for the adapter
 * named by the backend (`session.provider`).
 *
 * Adding a gateway on the web: write `adapters/<name>.ts` implementing this and
 * register it in adapters/registry.ts.
 */
export interface PaymentWidgetAdapter {
  readonly name: string;
  /** Shown under the online option, e.g. "Secured by Razorpay". */
  readonly label: string;
  /** Warm up (load the SDK script) so the widget opens instantly on "Pay". Optional. */
  preload?(): Promise<void>;
  open(input: WidgetInput): Promise<WidgetResult>;
}

export interface WidgetInput {
  /** Backend-built, gateway-specific options (keys, gateway order id, prefill...). */
  clientConfig: Record<string, unknown>;
  /** For theming the widget to match the storefront. */
  brandColor?: string;
}

export type WidgetResult =
  /** The widget reports a completed payment - send `gatewayResponse` to /payments/confirm. */
  | { kind: 'completed'; gatewayResponse: Record<string, unknown> }
  /** The gateway itself reported a decline it won't retry inside the widget. */
  | { kind: 'failed'; gatewayResponse?: Record<string, unknown>; message: string }
  /** Shopper closed the widget without paying. */
  | { kind: 'dismissed' };
