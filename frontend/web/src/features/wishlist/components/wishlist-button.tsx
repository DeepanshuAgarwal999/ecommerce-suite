'use client';

import { Heart } from 'lucide-react';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import type { Product } from '@/features/catalog/types';
import { cn } from '@/lib/utils';
import { useIsWishlisted, useToggleWishlist } from '../hooks/use-wishlist';

interface WishlistButtonProps {
  product: Product;
  className?: string;
}

/** The heart on a product card / detail page. Sits outside the card's <Link>,
 *  so it never needs to stop a navigation it was never inside of. */
export function WishlistButton({ product, className }: WishlistButtonProps) {
  const saved = useIsWishlisted(product.id);
  const toggle = useToggleWishlist();
  const requireAuth = useRequireAuth();

  return (
    <button
      type="button"
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={requireAuth(() =>
        toggle.mutate({
          productId: product.id,
          title: product.name,
          imageUrl: product.images[0]?.url,
          priceAtSave: product.pricePaise,
        }),
      )}
      className={cn(
        'bg-card grid size-9 place-items-center rounded-full shadow-[0_1px_4px_oklch(0.2_0.05_330/0.15)] transition-transform hover:scale-105 disabled:opacity-60',
        className,
      )}
    >
      <Heart
        className={cn('size-[18px] transition-colors', saved ? 'fill-highlight text-highlight' : 'text-foreground/80')}
        strokeWidth={1.9}
        aria-hidden
      />
    </button>
  );
}
