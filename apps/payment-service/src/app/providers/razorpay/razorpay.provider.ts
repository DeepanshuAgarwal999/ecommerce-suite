import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException, ErrorCode, hmacSha256, safeCompare } from '@ecommerce/common';
import { PaymentGateway, PaymentMethod, PaymentStatus, RefundStatus } from '@ecommerce/contracts';
import Razorpay from 'razorpay';
import type {
  ClientCheckoutInput,
  ClientConfirmation,
  CreateGatewayOrderInput,
  GatewayOrder,
  GatewayPayment,
  GatewayRefund,
  GatewayRefundInput,
  PaymentProvider,
  VerifiedWebhook,
  WebhookAction,
} from '../payment-provider';

/** Razorpay's payment object (the fields we read). */
interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string;
  vpa?: string;
  bank?: string;
  wallet?: string;
  card?: { network?: string; last4?: string; type?: string; issuer?: string };
  error_code?: string;
  error_description?: string;
}

interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
}

interface RzpWebhookBody {
  event: string;
  created_at: number;
  payload: { payment?: { entity: RzpPayment }; refund?: { entity: RzpRefund } };
}

/** Razorpay's webhook event names - known only to this adapter. */
const EVENTS = {
  PAYMENT: new Set(['payment.authorized', 'payment.captured', 'payment.failed']),
  REFUND: new Set(['refund.processed', 'refund.failed']),
};

/**
 * Razorpay adapter. Nothing outside this file knows Razorpay exists.
 *
 * Two HMAC checks live here, both constant-time (a timing leak on an HMAC compare is
 * how signatures get forged byte by byte):
 *  - checkout: Razorpay signs `${order_id}|${payment_id}` with the key secret;
 *  - webhook: Razorpay signs the raw request body with the webhook secret.
 */
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.RAZORPAY;
  readonly name = 'razorpay';

  private readonly logger = new Logger(RazorpayProvider.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private sdkInstance: Razorpay | null = null;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('razorpay.keyId', '');
    this.keySecret = config.get<string>('razorpay.keySecret', '');
    this.webhookSecret = config.get<string>('razorpay.webhookSecret', '');
  }

  assertConfigured(): void {
    const placeholder = (value: string) => !value || /x{6,}/i.test(value);
    if (placeholder(this.keyId) || placeholder(this.keySecret)) {
      throw new Error(
        'PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. ' +
          'Use test keys from dashboard.razorpay.com (Settings -> API Keys), or PAYMENT_PROVIDER=mock for local development.',
      );
    }
    if (placeholder(this.webhookSecret)) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET is not set - webhooks will be rejected; reconciliation still settles payments.');
    }
  }

  /** Created lazily so a deployment that never uses Razorpay never needs its keys. */
  private get sdk(): Razorpay {
    this.sdkInstance ??= new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    return this.sdkInstance;
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    try {
      const order = (await this.sdk.orders.create({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
        // Split payments complicate refunds and aren't offered.
        partial_payment: false,
      })) as unknown as { id: string; amount: number; currency: string };
      return { gatewayOrderId: order.id, amount: Number(order.amount), currency: order.currency };
    } catch (error) {
      throw this.translate(error, 'Could not start the payment. Please try again.');
    }
  }

  async fetchPayment(gatewayPaymentId: string): Promise<GatewayPayment> {
    try {
      return this.toPayment((await this.sdk.payments.fetch(gatewayPaymentId)) as unknown as RzpPayment);
    } catch (error) {
      throw this.translate(error, 'Could not fetch payment details from the gateway.');
    }
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]> {
    try {
      const result = (await this.sdk.orders.fetchPayments(gatewayOrderId)) as unknown as { items: RzpPayment[] };
      return (result.items ?? []).map((payment) => this.toPayment(payment));
    } catch (error) {
      throw this.translate(error, 'Could not fetch order payments from the gateway.');
    }
  }

  verifyClientConfirmation(gatewayOrderId: string, response: Record<string, unknown>): ClientConfirmation | null {
    const paymentId = String(response['razorpay_payment_id'] ?? '');
    const orderId = String(response['razorpay_order_id'] ?? '');
    const signature = String(response['razorpay_signature'] ?? '');
    if (!paymentId || !signature || orderId !== gatewayOrderId) return null;

    const expected = hmacSha256(`${gatewayOrderId}|${paymentId}`, this.keySecret);
    return safeCompare(expected, signature) ? { gatewayPaymentId: paymentId, signature } : null;
  }

  verifyWebhook({ rawBody, headers }: { rawBody: string; headers: Record<string, string | undefined> }): VerifiedWebhook {
    const signature = headers['x-razorpay-signature'] ?? '';
    // Razorpay sends an event id; hash the body for older payloads so retries still dedupe.
    const eventId = headers['x-razorpay-event-id'] || `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    let body: RzpWebhookBody | null = null;
    try {
      body = JSON.parse(rawBody) as RzpWebhookBody;
    } catch {
      body = null;
    }
    const valid =
      Boolean(body && signature && this.webhookSecret) && safeCompare(hmacSha256(rawBody, this.webhookSecret), signature);
    return { valid, eventId, eventType: body?.event ?? 'unparseable', signature, body };
  }

  interpretWebhook(raw: unknown): WebhookAction {
    const body = raw as RzpWebhookBody;
    if (EVENTS.PAYMENT.has(body?.event) && body.payload.payment?.entity) {
      return { kind: 'payment', payment: this.toPayment(body.payload.payment.entity) };
    }
    if (EVENTS.REFUND.has(body?.event) && body.payload.refund?.entity) {
      return { kind: 'refund', refund: this.toRefund(body.payload.refund.entity) };
    }
    // order.paid, refund.created, ... carry no state we don't already get above.
    return { kind: 'ignore', reason: `no action for ${body?.event}` };
  }

  async refund(input: GatewayRefundInput): Promise<GatewayRefund> {
    try {
      const refund = await this.sdk.payments.refund(input.gatewayPaymentId, {
        amount: input.amount,
        // `optimum` = instant where the bank supports it, normal (5-7 days) otherwise.
        speed: input.instant ? 'optimum' : 'normal',
        receipt: input.receipt,
        notes: input.notes,
      });
      return this.toRefund(refund as unknown as RzpRefund);
    } catch (error) {
      throw this.translate(error, 'The refund could not be processed by the gateway.');
    }
  }

  /** The options object for Razorpay Checkout (checkout.js `new Razorpay(options)` / mobile SDK `open`). */
  clientCheckout(input: ClientCheckoutInput): Record<string, unknown> {
    return {
      key: this.keyId,
      order_id: input.gatewayOrderId,
      amount: input.amount,
      currency: input.currency,
      name: input.merchantName,
      description: `Order ${input.orderNumber}`,
      prefill: {
        name: input.customer.name ?? '',
        contact: input.customer.contact ?? '',
        email: input.customer.email ?? '',
      },
      notes: { paymentId: input.paymentId },
    };
  }

  // --- vocabulary mapping ------------------------------------------------------

  private toPayment(payment: RzpPayment): GatewayPayment {
    return {
      gatewayPaymentId: payment.id,
      gatewayOrderId: payment.order_id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: this.mapStatus(payment.status),
      method: this.mapMethod(payment.method),
      methodDetails: {
        method: payment.method,
        vpa: payment.vpa,
        bank: payment.bank,
        wallet: payment.wallet,
        card: payment.card
          ? { network: payment.card.network, last4: payment.card.last4, type: payment.card.type, issuer: payment.card.issuer }
          : undefined,
      },
      errorCode: payment.error_code ?? undefined,
      errorReason: payment.error_description ?? undefined,
      raw: payment,
    };
  }

  private toRefund(refund: RzpRefund): GatewayRefund {
    return {
      gatewayRefundId: refund.id,
      gatewayPaymentId: refund.payment_id,
      amount: Number(refund.amount),
      status:
        refund.status === 'processed' ? RefundStatus.PROCESSED : refund.status === 'failed' ? RefundStatus.FAILED : RefundStatus.PENDING,
      raw: refund,
    };
  }

  private mapStatus(status: RzpPayment['status']): PaymentStatus {
    switch (status) {
      case 'authorized':
        return PaymentStatus.AUTHORIZED;
      case 'captured':
        return PaymentStatus.CAPTURED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'failed':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapMethod(method?: string): PaymentMethod | undefined {
    switch (method) {
      case 'upi':
        return PaymentMethod.UPI;
      case 'card':
        return PaymentMethod.CARD;
      case 'netbanking':
        return PaymentMethod.NETBANKING;
      case 'wallet':
        return PaymentMethod.WALLET;
      case 'emi':
      case 'cardless_emi':
        return PaymentMethod.EMI;
      case 'paylater':
        return PaymentMethod.PAY_LATER;
      default:
        return undefined;
    }
  }

  /** SDK errors -> our error shape, without leaking gateway internals. */
  private translate(error: unknown, fallback: string): AppException {
    const detail = (error as { error?: { code?: string; description?: string } })?.error;
    this.logger.error(`razorpay error: ${detail?.code ?? 'UNKNOWN'} ${detail?.description ?? (error as Error)?.message}`);
    return new AppException(ErrorCode.GATEWAY_ERROR, detail?.description ?? fallback, HttpStatus.BAD_GATEWAY, {
      details: detail?.code ? { gatewayCode: detail.code } : undefined,
    });
  }
}
