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
  APPLY_VENDOR: 'user.apply-vendor',
  GET_VENDOR: 'user.get-vendor',
  LIST_VENDORS: 'user.list-vendors',
  REVIEW_VENDOR: 'user.review-vendor',
  ADMIN_LIST_USERS: 'user.admin.list-users',
  /** One grouped query for the dashboard's vendor-status chart, instead of a
   *  separate `limit=1` filtered list call per status. */
  ADMIN_VENDORS_SUMMARY: 'user.admin-vendors-summary',
} as const;

export const CatalogPatterns = {
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
  GET_PRODUCT: 'catalog.get-product',
  GET_VARIANTS: 'catalog.get-variants',
  CREATE_PRODUCT: 'catalog.create-product',
  UPDATE_PRODUCT: 'catalog.update-product',
  REVIEW_PRODUCT: 'catalog.review-product',
  ARCHIVE_PRODUCT: 'catalog.archive-product',
  LIST_VENDOR_PRODUCTS: 'catalog.list-vendor-products',
  CREATE_REVIEW: 'catalog.create-review',
  LIST_REVIEWS: 'catalog.list-reviews',
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
} as const;

export const OrderPatterns = {
  CREATE_ORDER: 'order.create',
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
  VENDOR_LIST_ORDERS: 'order.vendor.list',
  TRACK: 'order.track',
} as const;

export const PaymentPatterns = {
  CREATE_CHECKOUT: 'payment.create-checkout',
  VERIFY_SIGNATURE: 'payment.verify-signature',
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
} as const;
