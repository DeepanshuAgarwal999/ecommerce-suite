/**
 * Single source of truth for React Query cache keys. Keys are hierarchical so
 * a mutation can invalidate a whole slice — e.g. queryKeys.vendors.all drops
 * every vendor query — without guessing at string shapes across features.
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: () => [...queryKeys.dashboard.all, 'overview'] as const,
    orderTrend: (days: number) => [...queryKeys.dashboard.all, 'order-trend', days] as const,
  },
  vendors: {
    all: ['vendors'] as const,
    list: (query: Record<string, unknown>) => [...queryKeys.vendors.all, 'list', query] as const,
    detail: (id: string) => [...queryKeys.vendors.all, 'detail', id] as const,
    counts: () => [...queryKeys.vendors.all, 'counts'] as const,
  },
  products: {
    all: ['products'] as const,
    list: (query: Record<string, unknown>) => [...queryKeys.products.all, 'list', query] as const,
    detail: (id: string) => [...queryKeys.products.all, 'detail', id] as const,
    insights: (id: string, months: number) => [...queryKeys.products.all, 'insights', id, months] as const,
    counts: () => [...queryKeys.products.all, 'counts'] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    stock: (query: Record<string, unknown>) => [...queryKeys.inventory.all, 'stock', query] as const,
    lowStock: () => [...queryKeys.inventory.all, 'low-stock'] as const,
    movements: (query: Record<string, unknown>) =>
      [...queryKeys.inventory.all, 'movements', query] as const,
    warehouses: () => [...queryKeys.inventory.all, 'warehouses'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (query: Record<string, unknown>) => [...queryKeys.orders.all, 'list', query] as const,
    detail: (id: string) => [...queryKeys.orders.all, 'detail', id] as const,
    counts: () => [...queryKeys.orders.all, 'counts'] as const,
  },
  banners: {
    all: ['banners'] as const,
    list: () => [...queryKeys.banners.all, 'list'] as const,
  },
  homeSections: {
    all: ['home-sections'] as const,
    list: () => [...queryKeys.homeSections.all, 'list'] as const,
  },
  insights: {
    all: ['insights'] as const,
    range: (days: number) => [...queryKeys.insights.all, days] as const,
  },
  themes: {
    all: ['themes'] as const,
    list: () => [...queryKeys.themes.all, 'list'] as const,
    live: () => [...queryKeys.themes.all, 'live'] as const,
  },
  footer: {
    all: ['footer'] as const,
    list: () => [...queryKeys.footer.all, 'list'] as const,
  },
} as const;
