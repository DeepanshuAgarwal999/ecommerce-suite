'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { useCartLines, useCartTotals } from '../hooks/use-cart';
import { CartLineItem } from './cart-line-item';
import { CartSummary } from './cart-summary';

interface CartViewProps {
  /** Shown under the empty state - the page passes server-rendered category shortcuts. */
  emptyExtra?: ReactNode;
}

export function CartView({ emptyExtra }: CartViewProps) {
  const hydrated = useHydrated();
  const lines = useCartLines();
  const totals = useCartTotals();

  // Persisted state is not available during SSR; render nothing until it is.
  if (!hydrated) return null;

  if (lines.length === 0) {
    return (
      <>
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="You haven't added anything yet. Pick a category below to get started."
          action={
            <Button asChild variant="outline">
              <Link href="/">Go to home page</Link>
            </Button>
          }
          className="pb-10"
        />
        {emptyExtra}
      </>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px] md:items-start">
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <CartLineItem key={line.productId} line={line} />
        ))}
      </ul>
      <CartSummary totals={totals} />
    </div>
  );
}
