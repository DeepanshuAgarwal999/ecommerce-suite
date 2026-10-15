import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/common/section-header';
import { catalogApi } from '@/features/catalog/api/catalog-api';

/**
 * Dense circular category strip, the same pattern Meesho/Flipkart open with —
 * a real photo per category rather than an illustrated icon.
 *
 * Self-contained like `ProductRail`: fetches its own data and renders nothing
 * on failure or when empty, so any page can drop in `<Suspense><CategoryTiles />
 * </Suspense>` with no data-fetching of its own to wire up.
 */
export async function CategoryTiles() {
  let categories;
  try {
    categories = await catalogApi.listCategories({ next: { revalidate: 300 } });
  } catch {
    return null;
  }

  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="shop-by-category" className="container pt-6 md:pt-10">
      <SectionHeader
        title="Shop by category"
        subtitle="Everything for the home, room by room"
        href="/c/all"
      />
      <ul className="rail -mx-4 grid grid-flow-col grid-rows-1 gap-4 overflow-x-auto px-4 md:mx-0 md:grid-cols-10 md:grid-flow-row md:gap-5 md:overflow-visible md:px-0">
        {categories.map((category) => (
          <li key={category.id} className="w-20 shrink-0 md:w-auto">
            <Link
              href={`/c/${category.slug}`}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <span className="relative block aspect-square w-20 overflow-hidden rounded-full ring-1 ring-border transition-shadow group-hover:shadow-[0_8px_24px_oklch(0.42_0.21_330/0.18)] md:w-full">
                <Image
                  src={category.imageUrl}
                  alt={category.name}
                  fill
                  sizes="(min-width: 768px) 10vw, 80px"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                />
              </span>
              <span className="line-clamp-2 text-xs font-bold md:text-sm">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Loading fallback for <Suspense>, dimensioned to match the real layout 1:1
 *  so content never shifts when it swaps in. */
export function CategoryTilesSkeleton() {
  return (
    <div className="container pt-6 md:pt-10">
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="grid grid-flow-col grid-rows-1 gap-4 overflow-hidden md:grid-cols-10 md:grid-flow-row md:gap-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex w-20 shrink-0 flex-col items-center gap-2 md:w-auto">
            <Skeleton className="aspect-square w-20 rounded-full md:w-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
