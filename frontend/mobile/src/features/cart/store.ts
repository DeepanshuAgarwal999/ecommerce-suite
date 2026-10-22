import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { trackRecommendation } from '@/features/analytics/track';
import type { Product } from '@/features/catalog/types';
import { zustandStorage } from '@/lib/storage';
import { useDeliveryEstimate } from '@/features/shipping/api';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { computeItemTotals } from './totals';
import { toCartLine, type CartLine, type CartTotals } from './types';

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

function without(lines: Record<string, CartLine>, productId: string): Record<string, CartLine> {
  const { [productId]: _removed, ...rest } = lines;
  return rest;
}

/**
 * Local-first cart, same contract as the web store: persisted (MMKV, so it is
 * hydrated synchronously before the first frame) and the single source of truth
 * the UI renders from. Checkout sends the lines as direct items to /orders.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: {},

      addItem: (product, quantity = 1) => {
        if (!get().lines[product.id]) trackRecommendation('cart', { productId: product.id });
        set((state) => {
          const existing = state.lines[product.id];
          const next = clamp((existing?.quantity ?? 0) + quantity, product.maxPerOrder);
          if (next === 0) return state;
          return { lines: { ...state.lines, [product.id]: toCartLine(product, next) } };
        });
      },

      setQuantity: (productId, quantity) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line) return state;
          const next = clamp(quantity, line.maxPerOrder);
          if (next === 0) return { lines: without(state.lines, productId) };
          return { lines: { ...state.lines, [productId]: { ...line, quantity: next } } };
        }),

      increment: (productId) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line || line.quantity >= line.maxPerOrder) return state;
          return { lines: { ...state.lines, [productId]: { ...line, quantity: line.quantity + 1 } } };
        }),

      decrement: (productId) =>
        set((state) => {
          const line = state.lines[productId];
          if (!line) return state;
          if (line.quantity <= 1) return { lines: without(state.lines, productId) };
          return { lines: { ...state.lines, [productId]: { ...line, quantity: line.quantity - 1 } } };
        }),

      removeItem: (productId) => set((state) => ({ lines: without(state.lines, productId) })),

      clear: () => set({ lines: {} }),
    }),
    { name: 'cart', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);

/*
 * Narrow selectors. A product card subscribes only to its own line's quantity,
 * so adding one item re-renders that card and the cart bar - not every card in
 * every rail on the home screen.
 */
export const useLineQuantity = (productId: string) =>
  useCartStore((state) => state.lines[productId]?.quantity ?? 0);

export const useCartCount = () =>
  useCartStore((state) => {
    let count = 0;
    for (const id in state.lines) count += state.lines[id]!.quantity;
    return count;
  });

/** Stable array of lines; recomputed only when the lines object changes. */
let cachedLines: Record<string, CartLine> | null = null;
let cachedArray: CartLine[] = [];
export function selectLines(state: CartState): CartLine[] {
  if (state.lines !== cachedLines) {
    cachedLines = state.lines;
    cachedArray = Object.values(state.lines);
  }
  return cachedArray;
}

export const useCartLines = () => useCartStore(selectLines);
/**
 * Cart totals: items computed locally (instant), delivery from the server
 * estimate (admin-managed rules, same calculator as checkout).
 */
export const useCartTotals = (): CartTotals => {
  const lines = useCartLines();
  const items = useMemo(() => computeItemTotals(lines), [lines]);
  const estimateLines = useMemo(
    () => lines.map((line) => ({ productId: line.productId, quantity: line.quantity, lineTotal: line.pricePaise * line.quantity })),
    [lines],
  );
  // Debounced: tapping + five times is one estimate, not five.
  const estimate = useDeliveryEstimate(useDebouncedValue(estimateLines, 300));
  const delivery = lines.length === 0 ? 0 : (estimate.data?.shippingTotal ?? 0);

  return useMemo(
    () => ({
      ...items,
      deliveryFeePaise: delivery,
      totalPaise: items.subtotalPaise + delivery,
      deliveryKnown: lines.length === 0 || Boolean(estimate.data),
      freeDeliveryRemaining: estimate.data?.freeShippingRemaining ?? null,
      freeDeliveryThreshold: estimate.data?.settings.freeShippingThreshold ?? null,
    }),
    [items, delivery, lines.length, estimate.data],
  );
};
