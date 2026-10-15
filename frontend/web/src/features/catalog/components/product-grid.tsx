import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './product-card';
import type { Product } from '../types';

interface ProductGridProps {
  products: Product[];
  className?: string;
}

/** Two columns on a phone, scaling to five on desktop — dense by intent. */
export function ProductGrid({ products, className }: ProductGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-card rounded-lg border p-2">
          <Skeleton className="mb-2 aspect-square w-full rounded-md" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-1 h-3 w-1/2" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
