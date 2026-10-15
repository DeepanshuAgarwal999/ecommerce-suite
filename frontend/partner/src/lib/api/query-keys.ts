/** Hierarchical React Query cache keys, so a mutation can invalidate a whole slice. */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  vendor: {
    all: ['vendor'] as const,
    me: () => [...queryKeys.vendor.all, 'me'] as const,
  },
  products: {
    all: ['products'] as const,
    list: (query: Record<string, unknown>) => [...queryKeys.products.all, 'list', query] as const,
    detail: (id: string) => [...queryKeys.products.all, 'detail', id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    lowStock: () => [...queryKeys.inventory.all, 'low-stock'] as const,
    warehouses: () => [...queryKeys.inventory.all, 'warehouses'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (query: Record<string, unknown>) => [...queryKeys.orders.all, 'list', query] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    categories: () => [...queryKeys.catalog.all, 'categories'] as const,
    brands: () => [...queryKeys.catalog.all, 'brands'] as const,
  },
} as const;
