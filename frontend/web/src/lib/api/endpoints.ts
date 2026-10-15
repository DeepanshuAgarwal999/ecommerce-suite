/**
 * Every gateway path the storefront knows about, in one place. When a service
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
  },
  home: {
    banners: '/catalog/home/banners',
    sections: '/catalog/home/sections',
    theme: '/catalog/home/theme',
  },
  footer: '/catalog/footer',
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
    detail: (id: string) => `/orders/${id}`,
  },
  address: {
    list: '/users/addresses',
    detail: (id: string) => `/users/addresses/${id}`,
  },
} as const;
