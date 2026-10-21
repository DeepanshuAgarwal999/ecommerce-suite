'use client';

import { ProceedToCheckoutButton } from '@/features/checkout/components/proceed-to-checkout-button';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/lib/utils/format';
import { amountToFreeDelivery } from '../totals';
import type { CartTotals } from '../types';

export function CartSummary({ totals }: { totals: CartTotals }) {
  const remaining = amountToFreeDelivery(totals.subtotalPaise);

  return (
    <aside className="bg-card flex flex-col gap-3 rounded-xl border p-4 md:sticky md:top-[calc(var(--header-height)+var(--category-nav-height)+1rem)] md:p-5">
      <h2 className="text-base font-extrabold">Order summary</h2>

      {remaining > 0 ? (
        <p className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-xs font-semibold">
          Add {formatPrice(remaining)} more for free delivery
        </p>
      ) : (
        <p className="text-success rounded-lg bg-[oklch(0.94_0.04_150)] px-3 py-2 text-xs font-bold">
          You have unlocked free delivery
        </p>
      )}

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal ({totals.itemCount} items)</dt>
          <dd className="tabular-nums">{formatPrice(totals.subtotalPaise)}</dd>
        </div>
        {totals.savingsPaise > 0 && (
          <div className="text-success flex justify-between font-semibold">
            <dt>You save</dt>
            <dd className="tabular-nums">-{formatPrice(totals.savingsPaise)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="tabular-nums">
            {totals.deliveryFeePaise === 0 ? 'Free' : formatPrice(totals.deliveryFeePaise)}
          </dd>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-extrabold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(totals.totalPaise)}</dd>
        </div>
      </dl>

      <ProceedToCheckoutButton />
    </aside>
  );
}
