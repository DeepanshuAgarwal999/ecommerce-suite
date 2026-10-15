import type { ProductQuery } from '@/features/catalog/types';

/**
 * Single source of truth for React Query cache keys. Keys are hierarchical so
 * a mutation can invalidate a whole slice — queryKeys.cart.all drops every
 * cart query — without guessing at string shapes scattered across features.
 */
export const queryKeys = {
  catalog: {
    all: ['catalog'] as const,
    categories: () => [...queryKeys.catalog.all, 'categories'] as const,
    category: (slug: string) =>
      [...queryKeys.catalog.all, 'category', slug] as const,
    products: (query: ProductQuery) =>
      [...queryKeys.catalog.all, 'products', query] as const,
    product: (slug: string) =>
      [...queryKeys.catalog.all, 'product', slug] as const,
  },
  search: {
    all: ['search'] as const,
    results: (term: string) =>
      [...queryKeys.search.all, 'results', term] as const,
    suggestions: (term: string) =>
      [...queryKeys.search.all, 'suggestions', term] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
    product: (productId: string) => [...queryKeys.recommendations.all, 'product', productId] as const,
    cart: (productIds: string[]) => [...queryKeys.recommendations.all, 'cart', productIds] as const,
    forYou: () => [...queryKeys.recommendations.all, 'for-you'] as const,
  },
  cart: {
    all: ['cart'] as const,
    current: () => [...queryKeys.cart.all, 'current'] as const,
  },
  wishlist: {
    all: ['wishlist'] as const,
    list: () => [...queryKeys.wishlist.all, 'list'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: () => [...queryKeys.orders.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.orders.all, 'detail', id] as const,
  },
  address: {
    all: ['address'] as const,
    list: () => [...queryKeys.address.all, 'list'] as const,
  },
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
} as const;
