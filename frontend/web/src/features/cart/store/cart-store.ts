import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { trackRecommendation } from '@/features/analytics/track';
import type { Product } from '@/features/catalog/types';
import { type CartLine, toCartLine } from '../types';

interface CartState {
  /** Keyed by product id so quantity edits are O(1) and order is stable. */
  lines: Record<string, CartLine>;
  addItem: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

function clamp(quantity: number, max: number): number {
  return Math.max(0, Math.min(quantity, max));
}

/**
 * The cart is local-first: it survives reload for signed-out users and is the
 * single source of truth the UI renders from. Reconciling it with the server
 * cart on sign-in is the checkout flow job, not this store.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: {},

      addItem: (product, quantity = 1) => {
        // First add of a product is a strong interest signal for recommendations.
        if (!get().lines[product.id]) trackRecommendation('cart', { productId: product.id });
        set((state) => {
          const existing = state.lines[product.id];
          const next = clamp(
            (existing?.quantity ?? 0) + quantity,
            product.maxPerOrder,
          );
          if (next === 0) return state;
          return {
            lines: { ...state.lines, [product.id]: toCartLine(product, next) },
          };
        });
      },

      setQuantity: (productId, quantity) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line) return state;

          const next = clamp(quantity, line.maxPerOrder);
          if (next === 0) {
            const { [productId]: _removed, ...rest } = state.lines;
            return { lines: rest };
          }
          return {
            lines: { ...state.lines, [productId]: { ...line, quantity: next } },
          };
        }),

      increment: (productId) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line) return state;
          return {
            lines: {
              ...state.lines,
              [productId]: {
                ...line,
                quantity: clamp(line.quantity + 1, line.maxPerOrder),
              },
            },
          };
        }),

      decrement: (productId) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line) return state;

          if (line.quantity <= 1) {
            const { [productId]: _removed, ...rest } = state.lines;
            return { lines: rest };
          }
          return {
            lines: {
              ...state.lines,
              [productId]: { ...line, quantity: line.quantity - 1 },
            },
          };
        }),

      removeItem: (productId) =>
        set((state) => {
          const { [productId]: _removed, ...rest } = state.lines;
          return { lines: rest };
        }),

      clear: () => set({ lines: {} }),
    }),
    {
      name: 'cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
