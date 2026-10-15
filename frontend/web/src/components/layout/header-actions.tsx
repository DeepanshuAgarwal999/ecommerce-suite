'use client';

import Link from 'next/link';
import { Heart, ShoppingCart, User } from 'lucide-react';
import { useCartItemCount } from '@/features/cart/hooks/use-cart';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-highlight text-highlight-foreground absolute -top-1 left-[15px] grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}

const itemClass =
  'relative flex h-11 min-w-11 flex-col items-center justify-center gap-1 text-foreground/90 transition-colors hover:text-primary';

/** Account / wishlist / cart cluster. Labels show from md up; phones get icons only. */
export function HeaderActions({ className }: { className?: string }) {
  const cartCount = useCartItemCount();
  const isSignedIn = useIsSignedIn();
  const openLogin = useUiStore((state) => state.openLogin);

  return (
    <nav
      aria-label="Account and cart"
      className={cn('flex items-center gap-1 md:gap-6', className)}
    >
      {isSignedIn ? (
        <Link href="/account" className={cn(itemClass, 'hidden md:flex')}>
          <User className="size-6" strokeWidth={1.9} aria-hidden />
          <span className="text-xs font-bold">Account</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          className={cn(itemClass, 'hidden md:flex')}
        >
          <User className="size-6" strokeWidth={1.9} aria-hidden />
          <span className="text-xs font-bold">Login</span>
        </button>
      )}

      <Link href="/account/wishlist" className={itemClass} aria-label="Wishlist">
        <Heart className="size-6" strokeWidth={1.9} aria-hidden />
        <span className="hidden text-xs font-bold md:block">Wishlist</span>
      </Link>

      <Link
        href="/cart"
        className={itemClass}
        aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
      >
        <ShoppingCart className="size-6" strokeWidth={1.9} aria-hidden />
        <span className="hidden text-xs font-bold md:block">Cart</span>
        <CountBadge count={cartCount} />
      </Link>
    </nav>
  );
}
