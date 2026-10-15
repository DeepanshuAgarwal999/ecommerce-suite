import { catalogApi } from '@/features/catalog/api/catalog-api';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryGrid } from './category-tiles';

/**
 * "Explore top categories" under an empty cart or wishlist - one tap back into
 * the catalogue instead of a dead end. A server component, handed to the
 * client-side cart/wishlist views as a ready-rendered slot, so it adds no
 * client fetch. Renders nothing if the catalogue is unreachable.
 */
export async function ExploreCategories() {
  let categories;
  try {
    categories = await catalogApi.listCategories({ next: { revalidate: 300 } });
  } catch {
    return null;
  }
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="explore-categories" className="mx-auto w-full max-w-5xl">
      <div className="mx-auto mb-8 h-px w-48 bg-border" aria-hidden />
      <h2 id="explore-categories" className="mb-4 text-lg font-bold md:text-xl">
        Explore top categories
      </h2>
      <CategoryGrid categories={categories} shape="squircle" />
    </section>
  );
}

export function ExploreCategoriesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Skeleton className="mb-4 h-6 w-52" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="size-[72px] shrink-0 rounded-[28%] md:size-28" />
        ))}
      </div>
    </div>
  );
}
