import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartLine } from '@/features/cart/types';
import type { PaymentChoice } from '@/features/payments/types';
import { zustandStorage } from '@/lib/storage';

/**
 * One payment attempt's identity - same design as the web checkout store. While
 * the shopper retries with the same items, address and method, "Pay" reuses
 * `idempotencyKey`, so the server hands back the same order (and its still-open
 * payment) instead of creating a duplicate.
 *
 * Persisted to MMKV (the web uses sessionStorage): if the OS kills the app while
 * the payment sheet is open, the next "Pay" still resolves to the same order.
 */
interface CheckoutAttempt {
  fingerprint: string;
  idempotencyKey: string;
  orderId?: string;
  createdAt: number;
}

/** An attempt older than the payment TTL (15 min server-side) would only hit an expired order. */
const ATTEMPT_TTL_MS = 30 * 60_000;

interface CheckoutState {
  /** "buy-now" checks out one item without touching the cart. */
  mode: 'cart' | 'buy-now';
  buyNowLine: CartLine | null;
  addressId: string | null;
  paymentChoice: PaymentChoice;
  attempt: CheckoutAttempt | null;
  startCartCheckout: () => void;
  startBuyNow: (line: CartLine) => void;
  setBuyNowQuantity: (quantity: number) => void;
  selectAddress: (addressId: string | null) => void;
  setPaymentChoice: (choice: PaymentChoice) => void;
  attemptFor: (fingerprint: string) => CheckoutAttempt;
  rememberOrder: (orderId: string) => void;
  resetAttempt: () => void;
  complete: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      mode: 'cart',
      buyNowLine: null,
      addressId: null,
      paymentChoice: 'ONLINE',
      attempt: null,
      startCartCheckout: () => set({ mode: 'cart', buyNowLine: null }),
      startBuyNow: (line) => set({ mode: 'buy-now', buyNowLine: line }),
      setBuyNowQuantity: (quantity) =>
        set((state) =>
          state.buyNowLine
            ? { buyNowLine: { ...state.buyNowLine, quantity: Math.max(1, Math.min(quantity, state.buyNowLine.maxPerOrder)) } }
            : state,
        ),
      selectAddress: (addressId) => set({ addressId }),
      setPaymentChoice: (paymentChoice) => set({ paymentChoice }),
      attemptFor: (fingerprint) => {
        const current = get().attempt;
        if (current && current.fingerprint === fingerprint && Date.now() - current.createdAt < ATTEMPT_TTL_MS) return current;
        const attempt = { fingerprint, idempotencyKey: Crypto.randomUUID(), createdAt: Date.now() };
        set({ attempt });
        return attempt;
      },
      rememberOrder: (orderId) => set((state) => (state.attempt ? { attempt: { ...state.attempt, orderId } } : state)),
      resetAttempt: () => set({ attempt: null }),
      complete: () => set({ mode: 'cart', buyNowLine: null, attempt: null }),
    }),
    { name: 'checkout', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);
