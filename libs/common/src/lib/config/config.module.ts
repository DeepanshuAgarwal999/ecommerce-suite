import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration';

/** Secrets that must be present, per service. Missing ones abort the boot. */
const REQUIRED_BY_SERVICE: Record<string, string[]> = {
  'api-gateway': ['JWT_ACCESS_SECRET'],
  'auth-service': ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'],
  'user-service': ['DATABASE_URL'],
  'catalog-service': ['DATABASE_URL'],
  'inventory-service': ['DATABASE_URL'],
  'cart-service': ['DATABASE_URL'],
  'order-service': ['DATABASE_URL'],
  'payment-service': ['DATABASE_URL', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  'notification-service': ['DATABASE_URL'],
  'recommendation-service': ['DATABASE_URL'],
};

/**
 * Fails fast on missing configuration.
 *
 * A service that starts with an empty JWT secret will happily sign tokens that nothing
 * can verify, and you find out in production. Checking at boot turns that into a
 * container that refuses to start, which a deploy pipeline catches.
 */
function validate(serviceName: string): void {
  const logger = new Logger('ConfigModule');
  const required = REQUIRED_BY_SERVICE[serviceName] ?? [];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[${serviceName}] missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const weakSecrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
      (key) => (process.env[key] ?? '').length < 32,
    );
    if (weakSecrets.length > 0) {
      throw new Error(
        `[${serviceName}] these secrets must be at least 32 characters in production: ` +
          weakSecrets.join(', '),
      );
    }
    if (process.env.OTP_DEV_FIXED_CODE) {
      throw new Error(`[${serviceName}] OTP_DEV_FIXED_CODE must not be set in production`);
    }
  }

  logger.log(`configuration validated for ${serviceName}`);
}

@Module({})
export class AppConfigModule {
  static forRoot(serviceName: string): DynamicModule {
    process.env.SERVICE_NAME = serviceName;

    return {
      module: AppConfigModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          // Root .env for local dev; in Docker/k8s the environment is injected directly.
          envFilePath: ['.env.local', '.env'],
          load: [configuration],
          expandVariables: true,
          validate: (raw) => {
            validate(serviceName);
            return raw;
          },
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
