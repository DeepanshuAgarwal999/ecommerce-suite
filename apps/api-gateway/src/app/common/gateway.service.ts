import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { rpc, rpcEmit } from '@ecommerce/common';
import { ServiceTokens } from '@ecommerce/contracts';

/**
 * One place that knows how to reach every downstream service.
 *
 * Controllers call `gateway.auth(pattern, payload)` rather than juggling eight injected
 * `ClientProxy` instances, and the timeout/error-rehydration policy in `rpc()` is
 * applied uniformly. Adding a service means adding one method here.
 */
@Injectable()
export class GatewayService {
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    @Inject(ServiceTokens.AUTH) private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.USER) private readonly userClient: ClientProxy,
    @Inject(ServiceTokens.CATALOG) private readonly catalogClient: ClientProxy,
    @Inject(ServiceTokens.INVENTORY) private readonly inventoryClient: ClientProxy,
    @Inject(ServiceTokens.CART) private readonly cartClient: ClientProxy,
    @Inject(ServiceTokens.ORDER) private readonly orderClient: ClientProxy,
    @Inject(ServiceTokens.PAYMENT) private readonly paymentClient: ClientProxy,
    @Inject(ServiceTokens.NOTIFICATION) private readonly notificationClient: ClientProxy,
    @Inject(ServiceTokens.RECOMMENDATION) private readonly recommendationClient: ClientProxy,
  ) {
    this.timeoutMs = config.get<number>('observability.rpcTimeoutMs', 10_000);
  }

  auth<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.authClient, pattern, payload, { timeoutMs: this.timeoutMs, service: 'auth-service' });
  }

  user<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.userClient, pattern, payload, { timeoutMs: this.timeoutMs, service: 'user-service' });
  }

  catalog<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.catalogClient, pattern, payload, {
      timeoutMs: this.timeoutMs,
      service: 'catalog-service',
    });
  }

  inventory<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.inventoryClient, pattern, payload, {
      timeoutMs: this.timeoutMs,
      service: 'inventory-service',
    });
  }

  cart<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.cartClient, pattern, payload, { timeoutMs: this.timeoutMs, service: 'cart-service' });
  }

  order<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.orderClient, pattern, payload, {
      // Order creation fans out to two services; give it a little more room.
      timeoutMs: this.timeoutMs * 2,
      service: 'order-service',
    });
  }

  payment<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.paymentClient, pattern, payload, {
      // Razorpay round trip sits inside this call.
      timeoutMs: this.timeoutMs * 2,
      service: 'payment-service',
    });
  }

  notification<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.notificationClient, pattern, payload, {
      timeoutMs: this.timeoutMs,
      service: 'notification-service',
    });
  }

  /**
   * Recommendation reads get a deliberately short leash: they decorate a page, they
   * never gate one. Callers catch and fall back to "nothing to show".
   */
  recommendation<T>(pattern: string, payload: unknown): Promise<T> {
    return rpc<T>(this.recommendationClient, pattern, payload, {
      timeoutMs: Math.min(this.timeoutMs, 1500),
      service: 'recommendation-service',
    });
  }

  /** Fire-and-forget event to recommendation-service - no reply, never blocks the request. */
  emitRecommendation(pattern: string, payload: unknown): void {
    rpcEmit(this.recommendationClient, pattern, payload);
  }
}
