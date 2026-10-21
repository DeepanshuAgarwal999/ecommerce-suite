import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '@ecommerce/common';
import { PaymentGateway, PaymentMethod, PaymentStatus, RefundStatus } from '@ecommerce/contracts';
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

interface MockOrder {
  amount: number;
  currency: string;
  payments: string[];
}

/**
 * Simulated gateway for local development and tests: the whole checkout -> confirm ->
 * order-confirmed -> refund loop runs without real credentials or network. The
 * storefront's mock adapter shows a "Pay / Fail" sheet instead of a real widget.
 *
 * It is also the reference implementation of PaymentProvider - the smallest complete
 * adapter, worth reading before writing a real one. State is in-process memory, so
 * it is single-replica only, and it refuses to run in production.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.MOCK;
  readonly name = 'mock';

  private readonly logger = new Logger(MockPaymentProvider.name);
  private readonly orders = new Map<string, MockOrder>();
  private readonly payments = new Map<string, GatewayPayment>();

  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    if (this.config.get<string>('nodeEnv') === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error('PAYMENT_PROVIDER=mock is not allowed in production.');
    }
    this.logger.warn('Using the MOCK payment gateway - no real money moves. Set PAYMENT_PROVIDER=razorpay for real payments.');
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    const gatewayOrderId = `mock_order_${randomUUID().slice(0, 12)}`;
    this.orders.set(gatewayOrderId, { amount: input.amount, currency: input.currency, payments: [] });
    return { gatewayOrderId, amount: input.amount, currency: input.currency };
  }

  async fetchPayment(gatewayPaymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(gatewayPaymentId);
    if (!payment) throw AppException.notFound('Mock payment', gatewayPaymentId);
    return payment;
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]> {
    return (this.orders.get(gatewayOrderId)?.payments ?? []).map((id) => this.payments.get(id) as GatewayPayment);
  }

  /**
   * The mock widget reports `{ outcome: 'success' | 'failure', method? }`. "Verifying"
   * it here is what a real gateway does on its own servers: the payment is created
   * in its terminal state.
   */
  verifyClientConfirmation(gatewayOrderId: string, response: Record<string, unknown>): ClientConfirmation | null {
    const order = this.orders.get(gatewayOrderId);
    if (!order || String(response['mock_order_id'] ?? '') !== gatewayOrderId) return null;

    const succeeded = response['outcome'] === 'success';
    const gatewayPaymentId = `mock_pay_${randomUUID().slice(0, 12)}`;
    const method = (Object.values(PaymentMethod) as string[]).includes(String(response['method']))
      ? (response['method'] as PaymentMethod)
      : PaymentMethod.UPI;
    this.payments.set(gatewayPaymentId, {
      gatewayPaymentId,
      gatewayOrderId,
      amount: order.amount,
      currency: order.currency,
      status: succeeded ? PaymentStatus.CAPTURED : PaymentStatus.FAILED,
      method,
      methodDetails: { method: method.toLowerCase(), simulated: true },
      errorCode: succeeded ? undefined : 'MOCK_DECLINED',
      errorReason: succeeded ? undefined : 'Payment declined (simulated)',
      raw: { simulated: true, outcome: response['outcome'] },
    });
    order.payments.push(gatewayPaymentId);
    return { gatewayPaymentId };
  }

  verifyWebhook(): VerifiedWebhook {
    return { valid: false, eventId: randomUUID(), eventType: 'mock.unsupported', signature: '', body: null };
  }

  interpretWebhook(): WebhookAction {
    return { kind: 'ignore', reason: 'the mock gateway sends no webhooks' };
  }

  async refund(input: GatewayRefundInput): Promise<GatewayRefund> {
    return {
      gatewayRefundId: `mock_rfnd_${randomUUID().slice(0, 12)}`,
      gatewayPaymentId: input.gatewayPaymentId,
      amount: input.amount,
      status: RefundStatus.PROCESSED,
      raw: { simulated: true },
    };
  }

  clientCheckout(input: ClientCheckoutInput): Record<string, unknown> {
    return {
      orderId: input.gatewayOrderId,
      amount: input.amount,
      currency: input.currency,
      merchantName: input.merchantName,
      description: `Order ${input.orderNumber}`,
    };
  }
}
