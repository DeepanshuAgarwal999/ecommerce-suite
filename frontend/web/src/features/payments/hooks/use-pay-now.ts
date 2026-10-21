'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCheckoutStore } from '@/features/checkout/store/checkout-store';
import { isApiError } from '@/lib/api';
import { getPaymentAdapter } from '../adapters/registry';
import { paymentsApi } from '../api/payments-api';
import type { CheckoutItemInput, PaymentChoice, PaymentSession, PaymentStatusView, PlacedOrder } from '../types';

export type PayPhase =
  | { kind: 'idle' }
  | { kind: 'working'; step: 'placing' | 'opening' | 'confirming' }
  /** The gateway declined; the order is still open, "Pay" again retries it. */
  | { kind: 'declined'; message: string }
  /** The shopper closed the payment window; the order is still open. */
  | { kind: 'dismissed' }
  | { kind: 'error'; message: string };

const ORDER_GONE = new Set(['INVALID_ORDER_TRANSITION']);
const PAID = new Set(['CAPTURED', 'AUTHORIZED']);

/** The exact amount the server will charge for these items with this method. */
export function useOrderQuote(items: CheckoutItemInput[], choice: PaymentChoice, pincode?: string) {
  return useQuery({
    queryKey: ['orders', 'quote', choice, pincode ?? '', items],
    queryFn: () => paymentsApi.quote({ paymentMethod: choice === 'COD' ? 'COD' : 'ONLINE', pincode, items }),
    enabled: items.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * The server won't take money for items it hasn't blocked yet. Stock is reserved
 * asynchronously right after the order is placed (usually ~1-2 s), so wait on the
 * order's own status - a cheap read - then open the payment once.
 */
async function startWhenStockHeld(orderId: string): Promise<PaymentSession> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = (await paymentsApi.getOrder(orderId)) as PlacedOrder & {
      saga?: { inventoryReserved: boolean } | null;
    };
    if (order.status === 'CANCELLED') {
      throw new Error('Sorry - some items went out of stock while placing your order. Nothing was charged.');
    }
    if (!order.saga || order.saga.inventoryReserved) {
      try {
        return await paymentsApi.startPayment(orderId);
      } catch (error) {
        if (!isApiError(error) || error.code !== 'STOCK_RESERVATION_PENDING') throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Reserving your items is taking longer than usual. Please tap Pay again.');
}

/** Poll briefly when the gateway says "processing" - the webhook usually lands within seconds. */
async function waitForOutcome(paymentId: string, first: PaymentStatusView): Promise<PaymentStatusView> {
  let status = first;
  for (let i = 0; i < 10 && status.status === 'PENDING' && !status.failureReason; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = await paymentsApi.getPayment(paymentId);
  }
  return status;
}

function messageOf(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'INSUFFICIENT_STOCK':
        return 'Some items just went out of stock. Please review your order.';
      case 'PRODUCT_UNAVAILABLE':
        return 'An item in your order is no longer available.';
      case 'STOCK_RESERVATION_PENDING':
        return 'We’re still reserving your items. Please tap Pay again in a moment.';
      case 'GATEWAY_ERROR':
        return 'The payment service is having trouble right now. Please try again in a moment.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * The whole "Pay" button: place the order (idempotently), open the active gateway's
 * widget via its adapter, confirm the result with the server, and report the outcome.
 * Gateway-agnostic - it never names a gateway; the server's `session.provider` picks
 * the adapter.
 */
export function usePayNow(input: {
  items: CheckoutItemInput[];
  addressId: string | null;
  pincode?: string;
  onPaid: (order: { orderId: string; orderNumber: string }) => void;
}) {
  const [phase, setPhase] = useState<PayPhase>({ kind: 'idle' });
  const attemptFor = useCheckoutStore((state) => state.attemptFor);
  const rememberOrder = useCheckoutStore((state) => state.rememberOrder);
  const resetAttempt = useCheckoutStore((state) => state.resetAttempt);
  const { items, addressId, pincode, onPaid } = input;

  const pay = useCallback(
    async (choice: PaymentChoice) => {
      if (!addressId || items.length === 0) return;
      const fingerprint = JSON.stringify({ items, addressId, choice });

      const placeOrder = async (): Promise<PlacedOrder> => {
        const attempt = attemptFor(fingerprint);
        const order = await paymentsApi.placeOrder(
          { addressId, paymentMethod: choice === 'COD' ? 'COD' : 'ONLINE', pincode, items },
          attempt.idempotencyKey,
        );
        rememberOrder(order.id);
        return order;
      };

      try {
        setPhase({ kind: 'working', step: 'placing' });
        let order = await placeOrder();

        if (choice === 'COD') {
          onPaid({ orderId: order.id, orderNumber: order.orderNumber });
          return;
        }

        let session;
        try {
          session = await startWhenStockHeld(order.id);
        } catch (error) {
          // The earlier order this attempt points at expired or was cancelled while the
          // shopper was away - start a fresh one, once.
          if (!isApiError(error) || !ORDER_GONE.has(error.code)) throw error;
          resetAttempt();
          order = await placeOrder();
          session = await startWhenStockHeld(order.id);
        }

        setPhase({ kind: 'working', step: 'opening' });
        const adapter = getPaymentAdapter(session.provider);
        const brandColor =
          getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || undefined;
        const result = await adapter.open({ clientConfig: session.clientConfig, brandColor });

        if (result.kind === 'dismissed') {
          setPhase({ kind: 'dismissed' });
          return;
        }
        if (result.kind === 'failed' && !result.gatewayResponse) {
          setPhase({ kind: 'declined', message: result.message });
          return;
        }

        setPhase({ kind: 'working', step: 'confirming' });
        const confirmed = await paymentsApi.confirm(session.paymentId, result.gatewayResponse ?? {});
        const outcome = await waitForOutcome(session.paymentId, confirmed);

        if (PAID.has(outcome.status)) {
          onPaid({ orderId: order.id, orderNumber: order.orderNumber });
          return;
        }
        setPhase({
          kind: 'declined',
          message:
            outcome.failureReason ??
            'We haven’t received confirmation from your bank yet. If money was debited, your order will confirm automatically.',
        });
      } catch (error) {
        setPhase({ kind: 'error', message: messageOf(error) });
      }
    },
    [addressId, items, pincode, attemptFor, rememberOrder, resetAttempt, onPaid],
  );

  /** Warm the gateway SDK while the shopper is still reviewing, so "Pay" opens instantly. */
  const preload = useCallback((provider: string) => {
    void getPaymentAdapter(provider).preload?.().catch(() => undefined);
  }, []);

  return { phase, pay, preload, busy: phase.kind === 'working' };
}
