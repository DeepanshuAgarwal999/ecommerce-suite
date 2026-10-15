'use client';

import { SectionHeader } from '@/components/common/section-header';
import type { Product } from '@/features/catalog/types';
import { ProductCard } from '@/features/catalog/components/product-card';
import { cn } from '@/lib/utils';
import { useImpressions } from '../hooks/use-impressions';

interface RecsRailProps {
  title: string;
  subtitle?: string;
  products: Product[];
  className?: string;
  /** Rails of recently-viewed items are memory aids, not recommendations - no fatigue tracking. */
  trackImpressions?: boolean;
}

/**
 * A horizontal rail of recommended products - same look as the home page's
 * ProductRail, but client-rendered (recommendations are per-shopper) and
 * reporting impressions so ignored items fade over time. Renders nothing when
 * empty, so a cold or unavailable recommender leaves no gap.
 */
export function RecsRail({ title, subtitle, products, className, trackImpressions = true }: RecsRailProps) {
  const ref = useImpressions<HTMLElement>(trackImpressions ? products.map((product) => product.id) : []);
  if (products.length === 0) return null;

  return (
    <section ref={ref} aria-label={title} className={cn('pt-8 md:pt-12', className)}>
      <SectionHeader title={title} subtitle={subtitle} />
      <ul className="rail -mx-4 px-4 md:mx-0 md:px-0">
        {products.map((product) => (
          <li key={product.id} className="w-[170px] md:w-[210px]">
            <ProductCard product={product} className="h-full" sizes="(min-width: 768px) 210px, 170px" />
          </li>
        ))}
      </ul>
    </section>
  );
}
