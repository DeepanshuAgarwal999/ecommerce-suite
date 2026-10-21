'use client';

import { useState } from 'react';
import { create } from 'zustand';
import { Building2, CreditCard, FlaskConical, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';
import type { PaymentWidgetAdapter, WidgetResult } from './types';

interface PendingMock {
  config: Record<string, unknown>;
  resolve: (result: WidgetResult) => void;
}

const useMockGateway = create<{ pending: PendingMock | null; set: (pending: PendingMock | null) => void }>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

/**
 * Dev-only stand-in for a real gateway's checkout widget (pairs with payment-service's
 * MockPaymentProvider, PAYMENT_PROVIDER=mock). Lets the whole order -> pay -> confirm
 * -> order confirmed loop, including declines and retries, run without credentials.
 */
export const mockAdapter: PaymentWidgetAdapter = {
  name: 'mock',
  label: 'Test mode - no real money',
  open: ({ clientConfig }) =>
    new Promise<WidgetResult>((resolve) => useMockGateway.getState().set({ config: clientConfig, resolve })),
};

const METHODS = [
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'NETBANKING', label: 'Netbanking', icon: Building2 },
] as const;

/** Mounted once on the checkout page; renders whenever the mock adapter is opened. */
export function MockGatewayDialog() {
  const pending = useMockGateway((state) => state.pending);
  const setPending = useMockGateway((state) => state.set);
  const [method, setMethod] = useState<string>('UPI');

  function finish(result: WidgetResult) {
    pending?.resolve(result);
    setPending(null);
  }

  const orderId = String(pending?.config['orderId'] ?? '');
  const response = (outcome: 'success' | 'failure') => ({ mock_order_id: orderId, outcome, method });

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && finish({ kind: 'dismissed' })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="text-promo size-5" aria-hidden />
            Test payment
          </DialogTitle>
          <DialogDescription>
            {String(pending?.config['description'] ?? '')} · Mock gateway - nothing is charged.
          </DialogDescription>
        </DialogHeader>

        <p className="text-3xl font-extrabold tabular-nums">{formatPrice(Number(pending?.config['amount'] ?? 0))}</p>

        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
          {METHODS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={method === option.value}
              onClick={() => setMethod(option.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition-colors',
                method === option.value ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40',
              )}
            >
              <option.icon className="size-5" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="h-11 w-full" onClick={() => finish({ kind: 'completed', gatewayResponse: response('success') })}>
            Pay successfully
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => finish({ kind: 'completed', gatewayResponse: response('failure') })}
          >
            Simulate a declined payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
