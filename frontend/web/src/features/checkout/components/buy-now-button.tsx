'use client';

import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import type { Product } from '@/features/catalog/types';
import { toCartLine } from '@/features/cart/types';
import { cn } from '@/lib/utils';
import { useCheckoutStore } from '../store/checkout-store';

/**
 * Straight to checkout with just this product - the cart is left untouched. Sign-in
 * first (addresses belong to an account); the login dialog opens in place if needed.
 */
export function BuyNowButton({ product, className }: { product: Product; className?: string }) {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const startBuyNow = useCheckoutStore((state) => state.startBuyNow);

  return (
    <Button
      type="button"
      size="lg"
      disabled={!product.inStock}
      className={cn('bg-promo text-promo-foreground hover:bg-promo/90 h-12 w-full text-[15px] font-extrabold', className)}
      onClick={requireAuth(() => {
        startBuyNow(toCartLine(product, 1));
        router.push('/checkout');
      })}
    >
      <Zap className="size-4 fill-current" aria-hidden />
      Buy now
    </Button>
  );
}
