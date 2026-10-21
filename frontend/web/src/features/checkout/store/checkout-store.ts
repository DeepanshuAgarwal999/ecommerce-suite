import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartLine } from '@/features/cart/types';
import type { PaymentChoice } from '@/features/payments/types';

/**
 * One payment attempt's identity. While the shopper retries with the same items,
 * address and method, "Pay" reuses `idempotencyKey`, so the server hands back the
 * same order (and its still-open payment) instead of creating a duplicate. Change
 * anything and a fresh key - a fresh order - is used.
 */
interface CheckoutAttempt {
  fingerprint: string;
  idempotencyKey: string;
  orderId?: string;
}

interface CheckoutState {
  /** "buy-now" checks out one item without touching the cart (Flipkart/Amazon behaviour). */
  mode: 'cart' | 'buy-now';
  buyNowLine: CartLine | null;
  /** The address chosen in step 1; null until the shopper picks one. */
  addressId: string | null;
  paymentChoice: PaymentChoice;
  attempt: CheckoutAttempt | null;
  startCartCheckout: () => void;
  startBuyNow: (line: CartLine) => void;
  setBuyNowQuantity: (quantity: number) => void;
  selectAddress: (addressId: string | null) => void;
  setPaymentChoice: (choice: PaymentChoice) => void;
  /** The idempotency key for this exact checkout, reused across retries. */
  attemptFor: (fingerprint: string) => CheckoutAttempt;
  rememberOrder: (orderId: string) => void;
  /** Forget the attempt (after success, or when its order can no longer be paid). */
  resetAttempt: () => void;
  /** Checkout finished - clear everything but the address choice. */
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
        if (current && current.fingerprint === fingerprint) return current;
        const attempt = { fingerprint, idempotencyKey: crypto.randomUUID() };
        set({ attempt });
        return attempt;
      },
      rememberOrder: (orderId) => set((state) => (state.attempt ? { attempt: { ...state.attempt, orderId } } : state)),
      resetAttempt: () => set({ attempt: null }),
      complete: () => set({ mode: 'cart', buyNowLine: null, attempt: null }),
    }),
    // Session storage: survives a refresh or the sign-in dialog, not days.
    { name: 'checkout', storage: createJSONStorage(() => sessionStorage) },
  ),
);
