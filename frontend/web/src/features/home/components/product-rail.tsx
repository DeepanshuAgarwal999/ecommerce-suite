import { SectionHeader } from '@/components/common/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { catalogApi } from '@/features/catalog/api/catalog-api';
import { ProductCard } from '@/features/catalog/components/product-card';
import type { ProductQuery } from '@/features/catalog/types';

interface ProductRailProps {
  title: string;
  subtitle?: string;
  href: string;
  query: ProductQuery;
}

/**
 * Horizontal product rail fetched on the server. Renders nothing at all when
 * the catalog is unreachable or empty, so the home page never shows a broken
 * section while the backend is still coming up — it simply appears once data
 * exists.
 */
export async function ProductRail({ title, subtitle, href, query }: ProductRailProps) {
  let products;
  try {
    const page = await catalogApi.listProducts(
      { pageSize: 10, ...query },
      { next: { revalidate: 300 } },
    );
    products = page.items;
  } catch {
    return null;
  }

  if (products.length === 0) return null;

  return (
    <section aria-label={title} className="container pt-8 md:pt-14">
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <ul className="rail -mx-4 px-4 md:mx-0 md:px-0">
        {products.map((product) => (
          <li key={product.id} className="w-[180px] md:w-[224px]">
            {/* Fixed rail width, not a grid fraction of the viewport - overriding
                the card's grid-tuned default keeps the requested image small. */}
            <ProductCard product={product} className="h-full" sizes="(min-width: 768px) 224px, 180px" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Loading fallback for <Suspense>, dimensioned to match the real rail 1:1
 *  so content never shifts when it swaps in. */
export function ProductRailSkeleton() {
  return (
    <div className="container pt-8 md:pt-14">
      <Skeleton className="mb-3 h-5 w-48" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="w-[180px] shrink-0 md:w-[224px]">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
