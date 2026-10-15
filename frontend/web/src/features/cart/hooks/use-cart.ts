'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { useCartStore } from '../store/cart-store';
import { computeCartTotals } from '../totals';

/**
 * Object.values builds a new array every call, so this must go through
 * useShallow — a plain selector would re-render on every store write.
 */
export function useCartLines() {
  return useCartStore(useShallow((state) => Object.values(state.lines)));
}

export function useCartTotals() {
  const lines = useCartLines();
  return useMemo(() => computeCartTotals(lines), [lines]);
}

/** Badge count. Returns 0 until hydrated so SSR and first render agree. */
export function useCartItemCount(): number {
  const hydrated = useHydrated();
  const count = useCartStore((state) =>
    Object.values(state.lines).reduce((sum, line) => sum + line.quantity, 0),
  );
  return hydrated ? count : 0;
}

/** Drives the per-product stepper: 0 means "show the Add button". */
export function useCartQuantity(productId: string): number {
  const hydrated = useHydrated();
  const quantity = useCartStore(
    (state) => state.lines[productId]?.quantity ?? 0,
  );
  return hydrated ? quantity : 0;
}

export function useCartActions() {
  return useCartStore(
    useShallow((state) => ({
      addItem: state.addItem,
      setQuantity: state.setQuantity,
      increment: state.increment,
      decrement: state.decrement,
      removeItem: state.removeItem,
      clear: state.clear,
    })),
  );
}
