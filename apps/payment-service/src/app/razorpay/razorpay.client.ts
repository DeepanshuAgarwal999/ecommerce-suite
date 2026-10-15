import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException, ErrorCode, hmacSha256, safeCompare } from '@ecommerce/common';
import Razorpay from 'razorpay';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
  created_at: number;
  notes?: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string;
  captured: boolean;
  email?: string;
  contact?: string;
  vpa?: string;
  bank?: string;
  wallet?: string;
  card?: { network?: string; last4?: string; type?: string; issuer?: string };
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  speed_processed?: string;
  created_at: number;
}

/**
 * Thin wrapper around the Razorpay SDK.
 *
 * Everything that touches the gateway goes through here so the rest of the service
 * never sees SDK types, and so the two signature checks - the client-returned checkout
 * signature and the server-to-server webhook signature - are implemented exactly once.
 *
 * Both verifications use a constant-time compare. Razorpay signatures are HMACs over
 * attacker-influenceable input, and a timing leak on the compare is how an HMAC gets
 * forged byte by byte.
 */
@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);
  private readonly sdk: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('razorpay.keyId', '');
    this.keySecret = config.get<string>('razorpay.keySecret', '');
    this.webhookSecret = config.get<string>('razorpay.webhookSecret', '');

    this.sdk = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
  }

  /** Public key id the mobile SDK needs to open the checkout sheet. */
  get publicKeyId(): string {
    return this.keyId;
  }

  /**
   * Creates a Razorpay order for the given amount (paise).
   *
   * `receipt` is our order number, which shows up in the Razorpay dashboard and makes
   * reconciliation a join rather than a guess. `partial_payment` stays off - split
   * payments complicate refunds and are not a feature of this platform.
   */
  async createOrder(input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    try {
      const order = await this.sdk.orders.create({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
        partial_payment: false,
      });
      return order as unknown as RazorpayOrder;
    } catch (error) {
      throw this.translate(error, 'Could not start the payment. Please try again.');
    }
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    try {
      return (await this.sdk.payments.fetch(paymentId)) as unknown as RazorpayPayment;
    } catch (error) {
      throw this.translate(error, 'Could not fetch payment details from the gateway.');
    }
  }

  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    try {
      return (await this.sdk.orders.fetch(orderId)) as unknown as RazorpayOrder;
    } catch (error) {
      throw this.translate(error, 'Could not fetch order details from the gateway.');
    }
  }

  /** Manual capture, for the flow where auto-capture is disabled pending fraud review. */
  async capture(paymentId: string, amountPaise: number, currency: string): Promise<RazorpayPayment> {
    try {
      return (await this.sdk.payments.capture(
        paymentId,
        amountPaise,
        currency,
      )) as unknown as RazorpayPayment;
    } catch (error) {
      throw this.translate(error, 'Could not capture the payment.');
    }
  }

  /**
   * Refunds part or all of a payment.
   *
   * `speed: optimum` asks for an instant refund where the bank supports it and falls
   * back to normal (5-7 day) settlement otherwise. `receipt` is our refund id, so a
   * retried request with the same receipt is visibly the same refund in the dashboard.
   */
  async refund(input: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
    instant?: boolean;
  }): Promise<RazorpayRefund> {
    try {
      const refund = await this.sdk.payments.refund(input.paymentId, {
        amount: input.amountPaise,
        speed: input.instant ? 'optimum' : 'normal',
        receipt: input.receipt,
        notes: input.notes,
      });
      return refund as unknown as RazorpayRefund;
    } catch (error) {
      throw this.translate(error, 'The refund could not be processed by the gateway.');
    }
  }

  /**
   * Verifies the signature the mobile SDK returns after checkout.
   *
   * Razorpay signs `${order_id}|${payment_id}` with the key secret. A valid signature
   * proves the client is reporting a real payment - but the *authoritative* confirmation
   * is still the webhook. This check is what lets the app show "success" immediately;
   * the webhook is what lets us ship.
   */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!orderId || !paymentId || !signature) return false;
    const expected = hmacSha256(`${orderId}|${paymentId}`, this.keySecret);
    return safeCompare(expected, signature);
  }

  /**
   * Verifies a webhook against the *raw* request body.
   *
   * The signature covers the exact bytes Razorpay sent. Re-serialising the parsed JSON
   * would change whitespace and key order and break every check, which is why the
   * gateway forwards the raw body untouched.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature || !this.webhookSecret) return false;
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = hmacSha256(body, this.webhookSecret);
    return safeCompare(expected, signature);
  }

  /** Maps SDK errors to the app error shape without leaking gateway internals. */
  private translate(error: unknown, fallback: string): AppException {
    const detail = (error as { error?: { code?: string; description?: string } })?.error;
    this.logger.error(
      `razorpay error: ${detail?.code ?? 'UNKNOWN'} ${detail?.description ?? (error as Error)?.message}`,
    );

    return new AppException(
      ErrorCode.GATEWAY_ERROR,
      detail?.description ?? fallback,
      HttpStatus.BAD_GATEWAY,
      { details: detail?.code ? { gatewayCode: detail.code } : undefined },
    );
  }
}
