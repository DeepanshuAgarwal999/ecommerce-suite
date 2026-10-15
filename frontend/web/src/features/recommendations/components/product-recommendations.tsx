'use client';

import type { Product } from '@/features/catalog/types';
import { useProductRecommendations } from '../hooks/use-recommendations';
import { FrequentlyBoughtTogether } from './frequently-bought-together';
import { RecsRail } from './recs-rail';

/** Everything below the product detail: the bundle, then "also viewed", then similar. */
export function ProductRecommendations({ product }: { product: Product }) {
  const { data } = useProductRecommendations(product.id);
  if (!data) return null;

  return (
    <div className="container pb-8">
      <FrequentlyBoughtTogether product={product} addons={data.boughtTogether.items} source={data.boughtTogether.source} />
      <RecsRail
        title="Customers who viewed this also viewed"
        products={data.alsoViewed.items}
      />
      <RecsRail title="Similar products" subtitle="More from this category" products={data.similar.items} />
    </div>
  );
}
