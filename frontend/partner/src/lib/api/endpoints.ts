/** Every gateway path this console calls. Matches apps/api-gateway's controllers. */
export const endpoints = {
  auth: {
    requestOtp: '/auth/otp/request',
    verifyOtp: '/auth/otp/verify',
    refresh: '/auth/refresh',
    session: '/auth/me',
    logout: '/auth/logout',
  },
  vendor: {
    apply: '/vendor/apply',
    me: '/vendor/me',
    products: '/vendor/products',
    product: (id: string) => `/vendor/products/${id}`,
    inventory: '/vendor/inventory',
    inventoryAdjust: '/vendor/inventory/adjust',
    lowStock: '/vendor/inventory/low-stock',
    warehouses: '/vendor/inventory/warehouses',
    orders: '/vendor/orders',
    orderStatus: (id: string) => `/vendor/orders/${id}/status`,
  },
  catalog: {
    categories: '/catalog/categories',
    brands: '/catalog/brands',
  },
} as const;
