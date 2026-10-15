'use client';

import { useCartRecommendations } from '../hooks/use-recommendations';
import { RecsRail } from './recs-rail';

/** "You might also need" - complements of everything in the cart, minus the cart itself. */
export function CartRecommendations({ productIds }: { productIds: string[] }) {
  const { data } = useCartRecommendations(productIds);
  if (!data || data.items.length === 0) return null;

  return (
    <RecsRail
      title="You might also need"
      subtitle={data.source === 'learned' ? 'Often bought with what’s in your cart' : 'Pairs well with your picks'}
      products={data.items}
    />
  );
}
