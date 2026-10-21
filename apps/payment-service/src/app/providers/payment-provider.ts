import type { PaymentGateway, PaymentMethod, PaymentStatus, RefundStatus } from '@ecommerce/contracts';

/**
 * The payment-gateway port.
 *
 * Everything gateway-specific - SDK calls, signature schemes, status vocabularies,
 * webhook formats, the shape of the browser checkout widget - lives behind this
 * interface in one adapter class per gateway (providers/<name>/). PaymentService,
 * RefundService and WebhookService only ever see the normalised types below.
 *
 * Adding a gateway (Cashfree, PhonePe, Stripe, Juspay...):
 *   1. add it to PaymentGateway (libs/contracts + payment-service schema enum);
 *   2. write `class XProvider implements PaymentProvider` in providers/x/;
 *   3. register it in providers/providers.ts;
 *   4. add a matching storefront adapter (frontend/web features/payments/providers/);
 *   5. set PAYMENT_PROVIDER=x plus its credentials.
 * No other file changes. Payments already made through the old gateway keep
 * settling (webhooks, refunds, reconciliation) through their own adapter, because
 * every payment row records which gateway created it.
 */
export interface PaymentProvider {
  /** Stored on every payment/webhook row this adapter handles. */
  readonly gateway: PaymentGateway;
  /** Lower-case id used in config (PAYMENT_PROVIDER) and the webhook URL (/payments/webhooks/:name). */
  readonly name: string;

  /** Throws with a clear message if credentials are missing - called at boot for the active provider. */
  assertConfigured(): void;

  /** A gateway-side order the customer will pay against. Amounts are always minor units (paise). */
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;

  /** Authoritative state of one payment, straight from the gateway. */
  fetchPayment(gatewayPaymentId: string): Promise<GatewayPayment>;

  /**
   * Every payment attempt made against a gateway order - lets reconciliation recover a
   * payment the customer completed but never reported (app killed, webhook lost).
   */
  fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]>;

  /**
   * Checks what the browser/app reported after the checkout widget closed. Returns the
   * gateway payment id it proves, or null if the proof is invalid (bad signature,
   * mismatched order). This only lets the UI show "success" quickly - the order still
   * ships on the gateway's own word (fetchPayment / webhook).
   */
  verifyClientConfirmation(
    gatewayOrderId: string,
    gatewayResponse: Record<string, unknown>,
  ): ClientConfirmation | null;

  /** Signature check + envelope parsing for a webhook, over the exact raw bytes received. */
  verifyWebhook(input: { rawBody: string; headers: Record<string, string | undefined> }): VerifiedWebhook;

  /** Turns a (verified, stored) webhook body into something the services can act on. */
  interpretWebhook(body: unknown): WebhookAction;

  refund(input: GatewayRefundInput): Promise<GatewayRefund>;

  /**
   * Exactly what the storefront's adapter for this gateway needs to open its checkout
   * widget (keys, gateway order id, prefill). Never includes secrets.
   */
  clientCheckout(input: ClientCheckoutInput): Record<string, unknown>;
}

export interface CreateGatewayOrderInput {
  amount: number;
  currency: string;
  /** Our order number - shows up in the gateway dashboard for reconciliation. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

/** A gateway payment, already translated into our vocabulary. */
export interface GatewayPayment {
  gatewayPaymentId: string;
  gatewayOrderId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  /** Network, bank, VPA, wallet - never card numbers (keeps us out of PCI scope). */
  methodDetails?: Record<string, unknown>;
  errorCode?: string;
  errorReason?: string;
  /** The gateway's own object, stored on the attempt row for forensics. */
  raw: unknown;
}

export interface ClientConfirmation {
  gatewayPaymentId: string;
  /** Kept on the payment for dispute evidence, when the gateway has one. */
  signature?: string;
}

export interface VerifiedWebhook {
  valid: boolean;
  /** The gateway's event id (or a hash of the body) - the idempotency key. */
  eventId: string;
  eventType: string;
  /** The signature the gateway sent (stored for forensics). */
  signature: string;
  /** Parsed JSON, or null when the body is not JSON. */
  body: unknown;
}

export type WebhookAction =
  | { kind: 'payment'; payment: GatewayPayment }
  | { kind: 'refund'; refund: GatewayRefund }
  | { kind: 'ignore'; reason: string };

export interface GatewayRefundInput {
  gatewayPaymentId: string;
  amount: number;
  /** Our refund id - a retried request is visibly the same refund at the gateway. */
  receipt: string;
  notes?: Record<string, string>;
  instant?: boolean;
}

export interface GatewayRefund {
  gatewayRefundId: string;
  gatewayPaymentId: string;
  amount: number;
  status: RefundStatus;
  raw: unknown;
}

export interface ClientCheckoutInput {
  paymentId: string;
  gatewayOrderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  merchantName: string;
  customer: { name?: string; contact?: string; email?: string | null };
}

/** DI token for the list of registered adapters. */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
