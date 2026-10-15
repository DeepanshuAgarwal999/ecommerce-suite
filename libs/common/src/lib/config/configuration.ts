/**
 * Central configuration factory.
 *
 * Every service loads this same object, so a value lives in exactly one place and can
 * be injected as `config.get('jwt.accessSecret')` anywhere. Secrets are read from the
 * environment only - nothing sensitive is ever defaulted to a working value, so a
 * missing secret fails loudly at boot instead of quietly running insecure.
 */

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toList = (value: string | undefined, fallback: string[] = []): string[] =>
  value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : fallback;

export interface TcpServiceEndpoint {
  host: string;
  port: number;
}

export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  serviceName: process.env.SERVICE_NAME ?? 'unknown-service',
  http: {
    port: toInt(process.env.PORT, 3000),
    globalPrefix: process.env.GLOBAL_PREFIX ?? 'api',
    /**
     * Explicit allowlist. A browser refuses `credentials: true` with a wildcard origin,
     * and the web clients need credentials for the refresh cookie - so in production
     * this must list the storefront, admin and vendor hosts. Dev defaults cover the
     * usual Next.js ports.
     */
    corsOrigins: toList(process.env.CORS_ORIGINS, [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4200',
      'http://localhost:4201',
      'http://localhost:4300',
      'http://localhost:5173',
    ]),
    /** Body size cap. Product image uploads go to object storage, not through here. */
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
    trustProxy: toBool(process.env.TRUST_PROXY, true),
  },
  /** TCP port this service listens on for gateway RPC (0 = not a microservice). */
  tcpPort: toInt(process.env.TCP_PORT, 0),

  database: {
    url: process.env.DATABASE_URL ?? '',
    /**
     * Postgres has a hard cap on connections and each pooled connection costs memory
     * on the server. With many replicas, point this at PgBouncer rather than raising it.
     */
    poolSize: toInt(process.env.DB_POOL_SIZE, 10),
    connectionTimeout: toInt(process.env.DB_CONNECTION_TIMEOUT, 10),
    logQueries: toBool(process.env.DB_LOG_QUERIES, false),
    slowQueryMs: toInt(process.env.DB_SLOW_QUERY_MS, 300),
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: toInt(process.env.REDIS_DB, 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? '',
    cluster: toBool(process.env.REDIS_CLUSTER, false),
  },

  kafka: {
    brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
    ssl: toBool(process.env.KAFKA_SSL, false),
    idempotentProducer: toBool(process.env.KAFKA_IDEMPOTENT_PRODUCER, true),
    sessionTimeout: toInt(process.env.KAFKA_SESSION_TIMEOUT, 30_000),
    consumerRetries: toInt(process.env.KAFKA_CONSUMER_RETRIES, 3),
    /** Guarded so a shared dev cluster is not reconfigured by every service on boot. */
    autoCreateTopics: toBool(process.env.KAFKA_AUTO_CREATE_TOPICS, true),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    /** Short access token + long refresh token: a stolen access token expires fast,
     *  and a refresh token can be revoked server-side because it is stored. */
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    issuer: process.env.JWT_ISSUER ?? 'ecommerce-platform',
    audience: process.env.JWT_AUDIENCE ?? 'ecommerce-clients',
  },

  otp: {
    length: toInt(process.env.OTP_LENGTH, 6),
    ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 300),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    resendCooldownSeconds: toInt(process.env.OTP_RESEND_COOLDOWN, 60),
    /** Per mobile number, per hour. Stops SMS-pumping fraud and runaway spend. */
    maxPerHour: toInt(process.env.OTP_MAX_PER_HOUR, 5),
    maxPerDay: toInt(process.env.OTP_MAX_PER_DAY, 15),
    /** Dev convenience: skip the SMS provider and accept a fixed code. Never in prod. */
    devFixedOtp: process.env.OTP_DEV_FIXED_CODE || undefined,
    defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE ?? '+91',
    defaultRegion: process.env.DEFAULT_PHONE_REGION ?? 'IN',
  },

  throttle: {
    ttlSeconds: toInt(process.env.THROTTLE_TTL, 60),
    // Shared across every authenticated route a user hits ("global" scope), so this
    // has to cover a whole console session, not one click - the admin dashboard alone
    // fires ~30 parallel requests on a single load (16 status counts + a 14-day trend
    // series), before any list page or CSV/Excel export is touched.
    limit: toInt(process.env.THROTTLE_LIMIT, 600),
    /** Tighter budget for unauthenticated traffic hitting the gateway. */
    anonymousLimit: toInt(process.env.THROTTLE_ANON_LIMIT, 30),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    currency: process.env.RAZORPAY_CURRENCY ?? 'INR',
    /** Auto-capture at authorisation. Set false to capture manually after fraud checks. */
    autoCapture: toBool(process.env.RAZORPAY_AUTO_CAPTURE, true),
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    /** Env vars cannot hold real newlines, so the PEM is stored with literal \n. */
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || undefined,
    /** FCM caps multicast at 500 tokens per request. */
    multicastBatchSize: toInt(process.env.FCM_BATCH_SIZE, 500),
  },

  sms: {
    provider: process.env.SMS_PROVIDER ?? 'console',
    senderId: process.env.SMS_SENDER_ID ?? 'ECOMRC',
    msg91: {
      authKey: process.env.MSG91_AUTH_KEY ?? '',
      templateId: process.env.MSG91_TEMPLATE_ID ?? '',
      baseUrl: process.env.MSG91_BASE_URL ?? 'https://control.msg91.com/api/v5',
    },
  },

  /** Downstream TCP endpoints, used by the gateway to register microservice clients. */
  services: {
    auth: {
      host: process.env.AUTH_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.AUTH_SERVICE_TCP_PORT, 4001),
    },
    user: {
      host: process.env.USER_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.USER_SERVICE_TCP_PORT, 4002),
    },
    catalog: {
      host: process.env.CATALOG_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.CATALOG_SERVICE_TCP_PORT, 4003),
    },
    inventory: {
      host: process.env.INVENTORY_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.INVENTORY_SERVICE_TCP_PORT, 4004),
    },
    cart: {
      host: process.env.CART_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.CART_SERVICE_TCP_PORT, 4005),
    },
    order: {
      host: process.env.ORDER_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.ORDER_SERVICE_TCP_PORT, 4006),
    },
    payment: {
      host: process.env.PAYMENT_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.PAYMENT_SERVICE_TCP_PORT, 4007),
    },
    notification: {
      host: process.env.NOTIFICATION_SERVICE_HOST ?? 'localhost',
      port: toInt(process.env.NOTIFICATION_SERVICE_TCP_PORT, 4008),
    },
  } satisfies Record<string, TcpServiceEndpoint>,

  clients: {
    /** Native builds below these are answered with 426 Upgrade Required. Empty = off. */
    minAndroidVersion: process.env.MIN_APP_VERSION_ANDROID ?? '',
    minIosVersion: process.env.MIN_APP_VERSION_IOS ?? '',
    /**
     * Web clients get the refresh token as an httpOnly cookie instead of in the JSON
     * body, so an XSS on the storefront cannot exfiltrate it. Mobile keeps the body.
     */
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    cookieSecure: toBool(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    cookieSameSite: (process.env.AUTH_COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  },

  observability: {
    logLevel: process.env.LOG_LEVEL ?? 'info',
    prettyLogs: toBool(process.env.PRETTY_LOGS, process.env.NODE_ENV !== 'production'),
    /** Request timeout enforced by the interceptor, ahead of any client timeout. */
    requestTimeoutMs: toInt(process.env.REQUEST_TIMEOUT_MS, 15_000),
    rpcTimeoutMs: toInt(process.env.RPC_TIMEOUT_MS, 10_000),
  },

  business: {
    freeShippingThreshold: toInt(process.env.FREE_SHIPPING_THRESHOLD, 49900),
    defaultShippingFee: toInt(process.env.DEFAULT_SHIPPING_FEE, 4900),
    codFee: toInt(process.env.COD_FEE, 2900),
    /** GST in basis points (1800 = 18%), so tax maths stays in integers. */
    defaultTaxBps: toInt(process.env.DEFAULT_TAX_BPS, 1800),
    stockHoldSeconds: toInt(process.env.STOCK_HOLD_SECONDS, 900),
    quickCommerceSlaMinutes: toInt(process.env.QUICK_COMMERCE_SLA_MINUTES, 15),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
