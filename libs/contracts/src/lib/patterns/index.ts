/**
 * Request/response message patterns.
 *
 * Kafka carries asynchronous facts between services. Synchronous calls - the ones the
 * gateway makes while an HTTP request is waiting - go over the NestJS TCP transport
 * instead, because request/reply over Kafka needs a reply topic per call and adds
 * latency to the hot read path. These constants are the RPC surface of each service.
 *
 * Swapping TCP for gRPC later means changing the transport in `main.ts` and the client
 * registration in the gateway; these pattern names stay the same.
 */

export const AuthPatterns = {
  REQUEST_OTP: 'auth.request-otp',
  VERIFY_OTP: 'auth.verify-otp',
  REFRESH_TOKEN: 'auth.refresh-token',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout-all',
  ME: 'auth.me',
  SET_EMAIL: 'auth.set-email',
  VERIFY_EMAIL: 'auth.verify-email',
  SET_MPIN: 'auth.set-mpin',
  LOGIN_MPIN: 'auth.login-mpin',
  ASSIGN_ROLES: 'auth.assign-roles',
  BLOCK_USER: 'auth.block-user',
  LIST_SESSIONS: 'auth.list-sessions',
  ADMIN_LIST_IDENTITIES: 'auth.admin.list-identities',
} as const;

export const UserPatterns = {
  GET_PROFILE: 'user.get-profile',
  UPDATE_PROFILE: 'user.update-profile',
  LIST_ADDRESSES: 'user.list-addresses',
  CREATE_ADDRESS: 'user.create-address',
  UPDATE_ADDRESS: 'user.update-address',
  DELETE_ADDRESS: 'user.delete-address',
  SET_DEFAULT_ADDRESS: 'user.set-default-address',
  GET_ADDRESS: 'user.get-address',
  /** Map pin -> address fields (address form "use my location"). */
  GEO_REVERSE: 'user.geo-reverse',
  /** Pincode -> city/state/areas (address form autofill). */
  GEO_PINCODE: 'user.geo-pincode',
  APPLY_VENDOR: 'user.apply-vendor',
  GET_VENDOR: 'user.get-vendor',
  /** Bulk lookup by vendorCode - product import references vendors by code. */
  GET_VENDORS_BY_CODES: 'user.get-vendors-by-codes',
  LIST_VENDORS: 'user.list-vendors',
  REVIEW_VENDOR: 'user.review-vendor',
  ADMIN_LIST_USERS: 'user.admin.list-users',
  /** One grouped query for the dashboard's vendor-status chart, instead of a
   *  separate `limit=1` filtered list call per status. */
  ADMIN_VENDORS_SUMMARY: 'user.admin-vendors-summary',
} as const;

export const CatalogPatterns = {
  // --- delivery charges (admin-managed, see ShippingService) ---
  /** Store-wide delivery settings (public read). */
  GET_SHIPPING_SETTINGS: 'catalog.shipping.get-settings',
  UPDATE_SHIPPING_SETTINGS: 'catalog.shipping.update-settings',
  LIST_SHIPPING_RULES: 'catalog.shipping.list-rules',
  UPSERT_SHIPPING_RULE: 'catalog.shipping.upsert-rule',
  DELETE_SHIPPING_RULE: 'catalog.shipping.delete-rule',
  /** Settings + effective rule per product - what cart-service prices orders with. */
  RESOLVE_SHIPPING: 'catalog.shipping.resolve',
  /** Public basket estimate, same calculator as the order total. */
  ESTIMATE_SHIPPING: 'catalog.shipping.estimate',
  LIST_CATEGORIES: 'catalog.list-categories',
  CATEGORY_TREE: 'catalog.category-tree',
  GET_CATEGORY: 'catalog.get-category',
  CREATE_CATEGORY: 'catalog.create-category',
  UPDATE_CATEGORY: 'catalog.update-category',
  LIST_BRANDS: 'catalog.list-brands',
  CREATE_BRAND: 'catalog.create-brand',
  SEARCH_PRODUCTS: 'catalog.search-products',
  /** Type-ahead for the storefront search box: a few categories + products per keystroke. */
  SEARCH_SUGGEST: 'catalog.search-suggest',
  /** Storefront engagement events (see catalog-service AnalyticsService). */
  TRACK_PRODUCT_VIEW: 'catalog.track-product-view',
  TRACK_SEARCH: 'catalog.track-search',
  /** Admin insights: top searches / zero-result searches / most-viewed over N days. */
  ADMIN_ENGAGEMENT_INSIGHTS: 'catalog.admin-engagement-insights',
  /** Storefront-ready cards for a list of product ids, in the order given (ACTIVE only). */
  PRODUCT_CARDS: 'catalog.product-cards',
  /** Name/slug/image for a list of category ids, in the order given. */
  CATEGORY_CARDS: 'catalog.category-cards',
  /** id + categoryId + status for every product, paged - recommendation-service backfill. */
  PRODUCT_INDEX: 'catalog.product-index',
  /** Products already created from an external source (import idempotency). */
  FIND_BY_EXTERNAL_IDS: 'catalog.find-by-external-ids',
  GET_PRODUCT: 'catalog.get-product',
  GET_VARIANTS: 'catalog.get-variants',
  CREATE_PRODUCT: 'catalog.create-product',
  UPDATE_PRODUCT: 'catalog.update-product',
  REVIEW_PRODUCT: 'catalog.review-product',
  ARCHIVE_PRODUCT: 'catalog.archive-product',
  LIST_VENDOR_PRODUCTS: 'catalog.list-vendor-products',
  CREATE_REVIEW: 'catalog.create-review',
  LIST_REVIEWS: 'catalog.list-reviews',
  /** Pending (unpublished) reviews for the admin moderation queue. */
  LIST_PENDING_REVIEWS: 'catalog.list-pending-reviews',
  /** The caller's own review for a product (to pre-fill the form / block duplicates). */
  GET_MY_REVIEW: 'catalog.get-my-review',
  APPROVE_REVIEW: 'catalog.approve-review',
  REJECT_REVIEW: 'catalog.reject-review',
  /** Bulk variant lookup used by cart/order to price a basket in one call. */
  RESOLVE_VARIANTS: 'catalog.resolve-variants',
  /** Cross-vendor, cross-status listing for the admin product console. */
  ADMIN_SEARCH_PRODUCTS: 'catalog.admin-search-products',
  /** One grouped query for the dashboard's product-status chart, instead of a
   *  separate `limit=1` filtered list call per status. */
  ADMIN_PRODUCTS_SUMMARY: 'catalog.admin-products-summary',
} as const;

/** Home page CMS: the banner carousel and the admin-curated image-tile shelves. */
export const MerchandisingPatterns = {
  LIST_BANNERS: 'merchandising.list-banners',
  ADMIN_LIST_BANNERS: 'merchandising.admin-list-banners',
  CREATE_BANNER: 'merchandising.create-banner',
  UPDATE_BANNER: 'merchandising.update-banner',
  DELETE_BANNER: 'merchandising.delete-banner',
  REORDER_BANNERS: 'merchandising.reorder-banners',

  LIST_HOME_SECTIONS: 'merchandising.list-home-sections',
  ADMIN_LIST_HOME_SECTIONS: 'merchandising.admin-list-home-sections',
  CREATE_HOME_SECTION: 'merchandising.create-home-section',
  UPDATE_HOME_SECTION: 'merchandising.update-home-section',
  DELETE_HOME_SECTION: 'merchandising.delete-home-section',
  REORDER_HOME_SECTIONS: 'merchandising.reorder-home-sections',

  CREATE_SECTION_TILE: 'merchandising.create-section-tile',
  UPDATE_SECTION_TILE: 'merchandising.update-section-tile',
  DELETE_SECTION_TILE: 'merchandising.delete-section-tile',
  REORDER_SECTION_TILES: 'merchandising.reorder-section-tiles',

  /** The occasion theme live right now (or null) - what the storefront skins itself with. */
  ACTIVE_THEME: 'merchandising.active-theme',
  ADMIN_LIST_THEMES: 'merchandising.admin-list-themes',
  CREATE_THEME: 'merchandising.create-theme',
  UPDATE_THEME: 'merchandising.update-theme',
  DELETE_THEME: 'merchandising.delete-theme',

  /** Columns, links and settings in one call - the footer renders from a single fetch. */
  GET_FOOTER: 'merchandising.get-footer',
  ADMIN_LIST_FOOTER_COLUMNS: 'merchandising.admin-list-footer-columns',
  CREATE_FOOTER_COLUMN: 'merchandising.create-footer-column',
  UPDATE_FOOTER_COLUMN: 'merchandising.update-footer-column',
  DELETE_FOOTER_COLUMN: 'merchandising.delete-footer-column',
  REORDER_FOOTER_COLUMNS: 'merchandising.reorder-footer-columns',
  CREATE_FOOTER_LINK: 'merchandising.create-footer-link',
  UPDATE_FOOTER_LINK: 'merchandising.update-footer-link',
  DELETE_FOOTER_LINK: 'merchandising.delete-footer-link',
  REORDER_FOOTER_LINKS: 'merchandising.reorder-footer-links',
  UPDATE_FOOTER_SETTINGS: 'merchandising.update-footer-settings',
} as const;

export const InventoryPatterns = {
  GET_AVAILABILITY: 'inventory.get-availability',
  BULK_AVAILABILITY: 'inventory.bulk-availability',
  UPSERT_STOCK: 'inventory.upsert-stock',
  ADJUST_STOCK: 'inventory.adjust-stock',
  LIST_WAREHOUSES: 'inventory.list-warehouses',
  CREATE_WAREHOUSE: 'inventory.create-warehouse',
  LIST_MOVEMENTS: 'inventory.list-movements',
  LOW_STOCK_REPORT: 'inventory.low-stock-report',
  /** Cross-vendor, cross-warehouse stock browser for the admin inventory console. */
  LIST_STOCK: 'inventory.list-stock',
  /** Admin product insights: on-hand / reserved / available across warehouses for one product. */
  PRODUCT_STOCK: 'inventory.product-stock',
} as const;

export const CartPatterns = {
  GET_CART: 'cart.get',
  ADD_ITEM: 'cart.add-item',
  UPDATE_ITEM: 'cart.update-item',
  REMOVE_ITEM: 'cart.remove-item',
  CLEAR: 'cart.clear',
  APPLY_COUPON: 'cart.apply-coupon',
  REMOVE_COUPON: 'cart.remove-coupon',
  GET_WISHLIST: 'cart.get-wishlist',
  TOGGLE_WISHLIST: 'cart.toggle-wishlist',
  /** Freezes the cart and returns a priced snapshot for order creation. */
  CHECKOUT_SNAPSHOT: 'cart.checkout-snapshot',
  /** Admin insights: products saved to the most wishlists. */
  ADMIN_TOP_WISHLISTED: 'cart.admin.top-wishlisted',
  /** Admin product insights: monthly wishlist saves for one product. */
  ADMIN_PRODUCT_WISHLIST: 'cart.admin.product-wishlist',
} as const;

export const OrderPatterns = {
  CREATE_ORDER: 'order.create',
  /** Exact server-side price for explicit items + payment method - creates nothing. */
  QUOTE: 'order.quote',
  GET_ORDER: 'order.get',
  LIST_MY_ORDERS: 'order.list-mine',
  CANCEL_ORDER: 'order.cancel',
  UPDATE_STATUS: 'order.update-status',
  REQUEST_RETURN: 'order.request-return',
  REVIEW_RETURN: 'order.return.review',
  RETURN_RECEIVED: 'order.return.received',
  ADMIN_LIST_ORDERS: 'order.admin.list',
  /** One grouped query for the dashboard's status-breakdown chart, instead of
   *  a separate `limit=1` filtered list call per status. */
  ADMIN_ORDERS_SUMMARY: 'order.admin.summary',
  /** One grouped query for the dashboard's N-day trend line, instead of one
   *  `limit=1` filtered list call per day. */
  ADMIN_ORDERS_TREND: 'order.admin.trend',
  /** Best sellers over N days (units, orders, revenue), plus the same stats for given product ids. */
  ADMIN_TOP_PRODUCTS: 'order.admin.top-products',
  /** Admin product insights: monthly orders/units/revenue/cancellations/returns for one product. */
  ADMIN_PRODUCT_SALES: 'order.admin.product-sales',
  VENDOR_LIST_ORDERS: 'order.vendor.list',
  TRACK: 'order.track',
} as const;

export const PaymentPatterns = {
  CREATE_CHECKOUT: 'payment.create-checkout',
  /** Browser/app reports the gateway widget's result; the gateway adapter verifies it. */
  CONFIRM: 'payment.confirm',
  /** Which gateway new payments use - lets clients preload its SDK and label the option. */
  ACTIVE_PROVIDER: 'payment.active-provider',
  /** Raw webhook from any gateway: { provider, rawBody, headers }. Gateway-only route. */
  WEBHOOK: 'payment.webhook',
  GET_PAYMENT: 'payment.get',
  LIST_MY_PAYMENTS: 'payment.list-mine',
  REFUND: 'payment.refund',
  LIST_REFUNDS: 'payment.list-refunds',
} as const;

export const NotificationPatterns = {
  REGISTER_DEVICE: 'notification.register-device',
  UNREGISTER_DEVICE: 'notification.unregister-device',
  LIST_INBOX: 'notification.list-inbox',
  UNREAD_COUNT: 'notification.unread-count',
  MARK_READ: 'notification.mark-read',
  MARK_ALL_READ: 'notification.mark-all-read',
  GET_PREFERENCES: 'notification.get-preferences',
  UPDATE_PREFERENCES: 'notification.update-preferences',
  BROADCAST: 'notification.broadcast',
} as const;

/** Injection tokens for the TCP clients registered in the gateway. */
export const ServiceTokens = {
  AUTH: 'AUTH_SERVICE',
  USER: 'USER_SERVICE',
  CATALOG: 'CATALOG_SERVICE',
  INVENTORY: 'INVENTORY_SERVICE',
  CART: 'CART_SERVICE',
  ORDER: 'ORDER_SERVICE',
  PAYMENT: 'PAYMENT_SERVICE',
  NOTIFICATION: 'NOTIFICATION_SERVICE',
  RECOMMENDATION: 'RECOMMENDATION_SERVICE',
  SUPPORT: 'SUPPORT_SERVICE',
} as const;

/**
 * recommendation-service. Activity arrives as fire-and-forget events (`emit`, no
 * reply awaited) so tracking can never slow a storefront request; reads are plain
 * request/response, called by the gateway with a short timeout and a silent fallback.
 */
export const RecommendationPatterns = {
  /** EventPattern: a shopper viewed / carted / wishlisted a product. */
  ACTIVITY: 'recommendation.activity',
  /** "Frequently bought together", "customers also viewed", similar - for one product. */
  FOR_PRODUCT: 'recommendation.for-product',
  /** "You might also need" for the products in a cart. */
  FOR_CART: 'recommendation.for-cart',
  /** Home page personalisation: recently viewed, favourite categories, picked for you. */
  FOR_USER: 'recommendation.for-user',
  /** Admin product insights: monthly views/carts/wishlists + category benchmarks. */
  PRODUCT_ACTIVITY: 'recommendation.product-activity',
} as const;

/**
 * support-service. The gateway runs the assistant's model loop (it streams to the
 * client and holds the user's identity); support-service persists conversations and
 * owns tickets and the agent queue.
 */
export const SupportPatterns = {
  // --- assistant conversations -------------------------------------------------
  /** Find-or-create a conversation for a user; returns it with llmHistory. */
  OPEN_CONVERSATION: 'support.open-conversation',
  /** Append one completed turn (display messages + new llmHistory blocks). */
  APPEND_TURN: 'support.append-turn',
  /** Store the assistant's ticket draft for customer confirmation. */
  SET_TICKET_DRAFT: 'support.set-ticket-draft',
  /** Customer-facing: a conversation's display messages. */
  GET_CONVERSATION: 'support.get-conversation',
  LIST_CONVERSATIONS: 'support.list-conversations',
  CONVERSATION_FEEDBACK: 'support.conversation-feedback',
  /** Turn the stored draft into a ticket. */
  CONFIRM_TICKET_DRAFT: 'support.confirm-ticket-draft',

  // --- customer tickets --------------------------------------------------------
  CREATE_TICKET: 'support.create-ticket',
  LIST_MY_TICKETS: 'support.list-my-tickets',
  GET_MY_TICKET: 'support.get-my-ticket',
  CUSTOMER_REPLY: 'support.customer-reply',

  // --- agent console -----------------------------------------------------------
  ADMIN_LIST_TICKETS: 'support.admin-list-tickets',
  ADMIN_GET_TICKET: 'support.admin-get-ticket',
  ADMIN_SUMMARY: 'support.admin-summary',
  /** Atomically assign the next ticket in the queue to the calling agent. */
  CLAIM_NEXT: 'support.claim-next',
  ADMIN_REPLY: 'support.admin-reply',
  ADMIN_UPDATE_TICKET: 'support.admin-update-ticket',
} as const;
