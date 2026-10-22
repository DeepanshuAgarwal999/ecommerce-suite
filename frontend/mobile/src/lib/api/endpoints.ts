/**
 * Every gateway path the app knows about (kept in step with frontend/web), in one place. When a service
 * route moves, this file is the only edit.
 */
export const endpoints = {
  auth: {
    requestOtp: '/auth/otp/request',
    verifyOtp: '/auth/otp/verify',
    refresh: '/auth/refresh',
    session: '/auth/me',
    logout: '/auth/logout',
  },
  catalog: {
    categories: '/catalog/categories',
    category: (slug: string) => `/catalog/categories/${slug}`,
    products: '/catalog/products',
    product: (slug: string) => `/catalog/products/${slug}`,
    productReviews: (productId: string) => `/catalog/products/${productId}/reviews`,
    myReview: (productId: string) => `/catalog/products/${productId}/reviews/mine`,
    reviewableOrders: (productId: string) => `/catalog/products/${productId}/reviewable-orders`,
    reviews: '/catalog/reviews',
  },
  home: {
    banners: '/catalog/home/banners',
    sections: '/catalog/home/sections',
    theme: '/catalog/home/theme',
  },
  footer: '/catalog/footer',
  track: {
    view: '/catalog/track/view',
    search: '/catalog/track/search',
    recs: '/recs/events',
  },
  notifications: {
    devices: '/notifications/devices',
    inbox: '/notifications',
    unreadCount: '/notifications/unread-count',
    read: '/notifications/read',
    readAll: '/notifications/read-all',
    preferences: '/notifications/preferences',
  },
  search: {
    query: '/search',
    /** Type-ahead: matching categories + products for a partial term. */
    suggest: '/catalog/search/suggest',
  },
  recommendations: {
    product: (productId: string) => `/recs/products/${productId}`,
    cart: '/recs/cart',
    forYou: '/recs/for-you',
  },
  cart: {
    current: '/cart',
    items: '/cart/items',
    item: (id: string) => `/cart/items/${id}`,
  },
  wishlist: {
    list: '/wishlist',
    toggle: '/wishlist/toggle',
  },
  checkout: {
    quote: '/checkout/quote',
    place: '/checkout/orders',
    payment: '/checkout/payment',
  },
  orders: {
    list: '/orders',
    quote: '/orders/quote',
    detail: (id: string) => `/orders/${id}`,
    cancel: (id: string) => `/orders/${id}/cancel`,
    returns: (id: string) => `/orders/${id}/returns`,
    track: (orderNumber: string) => `/orders/track/${orderNumber}`,
  },
  payments: {
    config: '/payments/config',
    checkout: '/payments/checkout',
    confirm: '/payments/confirm',
    detail: (id: string) => `/payments/${id}`,
  },
  address: {
    list: '/users/me/addresses',
    detail: (id: string) => `/users/me/addresses/${id}`,
    setDefault: (id: string) => `/users/me/addresses/${id}/default`,
  },
  geo: {
    reverse: '/geo/reverse',
    pincode: (pincode: string) => `/geo/pincode/${pincode}`,
  },
} as const;
