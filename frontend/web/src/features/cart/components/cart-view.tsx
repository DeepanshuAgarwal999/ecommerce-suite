'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { useCartLines, useCartTotals } from '../hooks/use-cart';
import { CartLineItem } from './cart-line-item';
import { CartSummary } from './cart-summary';

export function CartView() {
  const hydrated = useHydrated();
  const lines = useCartLines();
  const totals = useCartTotals();

  // Persisted state is not available during SSR; render nothing until it is.
  if (!hydrated) return null;

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Everything you add will show up here."
        action={
          <Button asChild>
            <Link href="/">Start shopping</Link>
          </Button>
        }
      />
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
