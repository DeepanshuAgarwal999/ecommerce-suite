import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '@ecommerce/common';
import type { PaymentGateway } from '@ecommerce/contracts';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider';

/**
 * Picks the adapter for each job:
 *  - `active()` - the gateway new payments go through (PAYMENT_PROVIDER);
 *  - `forGateway()` - the gateway an *existing* payment was made with, so refunds,
 *    webhooks and reconciliation for old payments keep working after a switch;
 *  - `byName()` - the webhook URL segment (/payments/webhooks/:name).
 */
@Injectable()
export class PaymentProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderRegistry.name);
  private readonly byGateway = new Map<PaymentGateway, PaymentProvider>();
  private readonly byNameMap = new Map<string, PaymentProvider>();
  private readonly activeName: string;

  constructor(@Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[], config: ConfigService) {
    for (const provider of providers) {
      this.byGateway.set(provider.gateway, provider);
      this.byNameMap.set(provider.name, provider);
    }
    this.activeName = config.get<string>('payments.provider', 'razorpay');
  }

  /** Fail fast at boot: a misconfigured gateway should stop the deploy, not the first customer. */
  onModuleInit(): void {
    const active = this.byNameMap.get(this.activeName);
    if (!active) {
      throw new Error(
        `PAYMENT_PROVIDER=${this.activeName} is not a registered gateway (known: ${[...this.byNameMap.keys()].join(', ')})`,
      );
    }
    active.assertConfigured();
    this.logger.log(`active payment gateway: ${active.name}`);
  }

  active(): PaymentProvider {
    return this.byNameMap.get(this.activeName) as PaymentProvider;
  }

  forGateway(gateway: PaymentGateway): PaymentProvider {
    const provider = this.byGateway.get(gateway);
    if (!provider) throw AppException.unavailable(`No adapter registered for gateway ${gateway}`);
    return provider;
  }

  byName(name: string): PaymentProvider | undefined {
    return this.byNameMap.get(name.toLowerCase());
  }
}
