'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { useCartTotals } from '../hooks/use-cart';

const HIDDEN_ON = ['/cart', '/checkout'];

/**
 * Sticky "N items - total - View cart" bar that rides above the bottom nav
 * once the cart is non-empty. Hidden on the cart and checkout routes, where it
 * would duplicate the primary action.
 */
export function FloatingCartBar() {
  const pathname = usePathname();
  const { itemCount, totalPaise } = useCartTotals();

  if (itemCount === 0 || HIDDEN_ON.some((route) => pathname.startsWith(route))) {
    return null;
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-bottom-nav z-40 px-3 pb-2 md:bottom-0 md:pb-4">
      <Link
        href="/cart"
        className="bg-primary text-primary-foreground mx-auto flex h-12 max-w-2xl items-center justify-between gap-3 rounded-lg px-4 shadow-lg transition-transform active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="size-4" aria-hidden />
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
          <span className="opacity-60">|</span>
          <span className="tabular-nums">{formatPrice(totalPaise)}</span>
        </span>
        <span className="text-sm font-semibold">View cart</span>
      </Link>
    </div>
  );
}
