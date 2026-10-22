/** Header names shared by the gateway and every downstream service. */
export const Headers = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  IDEMPOTENCY_KEY: 'idempotency-key',
  DEVICE_ID: 'x-device-id',
  /** Anonymous storefront visitor id (localStorage) - keys recommendations before sign-in. */
  VISITOR_ID: 'x-visitor-id',
  APP_VERSION: 'x-app-version',
  /** Coarse platform hint: android | ios | web. Prefer X-Client for source. */
  PLATFORM: 'x-platform',
  /** Which client this is: ANDROID | IOS | WEB | ADMIN_WEB | VENDOR_WEB. */
  CLIENT: 'x-client',
  /** Echoed on every response so clients can detect a version mismatch. */
  API_VERSION: 'x-api-version',
  /** Sent on responses when the API version in use is scheduled for removal. */
  DEPRECATION: 'deprecation',
  /** Set by the gateway after JWT verification; downstream services trust it only
   *  because they are unreachable from outside the cluster. */
  USER_ID: 'x-user-id',
  RAZORPAY_SIGNATURE: 'x-razorpay-signature',
} as const;

/** Redis key namespaces. Keeping them in one place makes cache invalidation auditable. */
export const CacheKeys = {
  otp: (mobile: string, purpose: string) => `otp:${purpose}:${mobile}`,
  otpAttempts: (mobile: string, purpose: string) => `otp:attempts:${purpose}:${mobile}`,
  otpResendWindow: (mobile: string) => `otp:resend:${mobile}`,
  session: (sessionId: string) => `session:${sessionId}`,
  userSessions: (userId: string) => `session:user:${userId}`,
  tokenVersion: (userId: string) => `auth:tv:${userId}`,
  blockedUser: (userId: string) => `auth:blocked:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  product: (productId: string) => `catalog:product:${productId}`,
  productBySlug: (slug: string) => `catalog:product:slug:${slug}`,
  categoryTree: () => `catalog:category:tree`,
  homeBanners: () => `catalog:home:banners`,
  homeSections: () => `catalog:home:sections`,
  footer: () => `catalog:footer`,
  shippingSettings: () => `catalog:shipping:settings`,
  /** Category rules + parent links, used to resolve inherited rules without a tree walk per query. */
  shippingCategoryRules: () => `catalog:shipping:category-rules`,
  activeTheme: () => `catalog:home:theme`,
  searchSuggest: (term: string) => `catalog:suggest:${term}`,
  /** Per-day engagement leaderboards (Redis sorted sets) - `day` is YYYY-MM-DD (IST).
   *  The `{stats}` hash tag pins every stats key to one Redis Cluster slot, so a
   *  multi-day ZUNIONSTORE stays legal if Redis is ever clustered. */
  statsViews: (day: string) => `{stats}:views:${day}`,
  statsSearches: (day: string) => `{stats}:searches:${day}`,
  statsZeroSearches: (day: string) => `{stats}:searches0:${day}`,
  /** Per-day totals as a hash: { views, searches, zeroSearches }. */
  statsTotals: (day: string) => `{stats}:totals:${day}`,
  statsScratch: (name: string) => `{stats}:tmp:${name}`,
  adminInsights: (kind: 'engagement' | 'orders' | 'wishlist', days: number) => `admin:insights:${kind}:${days}`,
  variantPricing: (variantId: string) => `catalog:variant:${variantId}`,
  availability: (sku: string) => `inventory:availability:${sku}`,
  cart: (userId: string) => `cart:${userId}`,
  unreadCount: (userId: string) => `notification:unread:${userId}`,
  idempotency: (scope: string, key: string) => `idem:${scope}:${key}`,
  rateLimit: (scope: string, subject: string) => `rl:${scope}:${subject}`,
  lock: (resource: string) => `lock:${resource}`,
  processedEvent: (group: string, eventId: string) => `evt:${group}:${eventId}`,
  /** Admin dashboard aggregates - one cached row per entity/shape rather than
   *  per status, since the whole point is answering "all statuses" in one go. */
  adminSummary: (entity: 'vendors' | 'products' | 'orders') => `admin:summary:${entity}`,
  adminOrderTrend: (days: number) => `admin:summary:orders:trend:${days}`,
} as const;

/** Default TTLs in seconds. */
export const CacheTtl = {
  OTP: 300,
  OTP_RESEND_WINDOW: 60,
  SESSION: 60 * 60 * 24 * 30,
  USER_PROFILE: 300,
  PRODUCT: 600,
  CATEGORY_TREE: 3600,
  /** Home page CMS content - changes a few times a week, read on every visit. */
  HOME_CONTENT: 300,
  /** Type-ahead results: short, since it is per-term and the catalogue keeps moving. */
  SEARCH_SUGGEST: 60,
  AVAILABILITY: 15,
  CART: 60 * 60 * 24 * 30,
  IDEMPOTENCY: 60 * 60 * 24,
  PROCESSED_EVENT: 60 * 60 * 24 * 3,
  /** Dashboard aggregates: cheap to compute but hit by every staff page load -
   *  short enough that a status change (vendor approved, order shipped) shows
   *  up within a refresh or two, long enough to absorb a burst of concurrent
   *  admin traffic without re-querying per request. */
  ADMIN_SUMMARY: 30,
  /** How long per-day engagement counters live - longest insights range + headroom. */
  STATS_RETENTION: 60 * 60 * 24 * 100,
  /** Insights aggregates - a heavier read than the dashboard; a few minutes stale is fine. */
  ADMIN_INSIGHTS: 120,
} as const;

export const Limits = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_CART_ITEMS: 50,
  MAX_CART_QUANTITY_PER_ITEM: 10,
  MAX_ADDRESSES_PER_USER: 20,
  MAX_DEVICES_PER_USER: 10,
  OTP_LENGTH: 6,
  MAX_OTP_ATTEMPTS: 5,
  /** Reservation hold. Long enough for a UPI collect request, short enough that a
   *  dropped checkout does not strand stock. */
  STOCK_HOLD_SECONDS: 900,
} as const;

export const ServiceNames = {
  API_GATEWAY: 'api-gateway',
  AUTH: 'auth-service',
  USER: 'user-service',
  CATALOG: 'catalog-service',
  INVENTORY: 'inventory-service',
  CART: 'cart-service',
  ORDER: 'order-service',
  PAYMENT: 'payment-service',
  NOTIFICATION: 'notification-service',
  RECOMMENDATION: 'recommendation-service',
  SUPPORT: 'support-service',
} as const;

/**
 * How a HomeSection renders on the storefront. Stored as a plain string on the
 * row (see schema.prisma) so this list is the single source of truth.
 */
export const HomeSectionLayout = {
  /** Image tiles linking anywhere - "Shop by occasion". Shape set by config.tileShape. */
  TILE_GRID: 'TILE_GRID',
  /** One large promo card beside two stacked ones, each a tile with subtitle + CTA. */
  SPLIT_BANNERS: 'SPLIT_BANNERS',
  /** A grid of real products from a category / sort. No tiles needed. */
  PRODUCT_GRID: 'PRODUCT_GRID',
  /** Tabs (one per tile, each bound to a category) switching a product row. */
  PRODUCT_TABS: 'PRODUCT_TABS',
  /** Product rail under a live countdown on a tinted band. */
  DEAL_OF_DAY: 'DEAL_OF_DAY',
} as const;
export type HomeSectionLayout = (typeof HomeSectionLayout)[keyof typeof HomeSectionLayout];

/** Occasion skins the storefront ships artwork for. CUSTOM = colours only. */
export const ThemePreset = {
  DIWALI: 'DIWALI',
  HOLI: 'HOLI',
  NAVRATRI: 'NAVRATRI',
  RAKHI: 'RAKHI',
  INDEPENDENCE: 'INDEPENDENCE',
  EID: 'EID',
  CHRISTMAS: 'CHRISTMAS',
  CUSTOM: 'CUSTOM',
} as const;
export type ThemePreset = (typeof ThemePreset)[keyof typeof ThemePreset];
