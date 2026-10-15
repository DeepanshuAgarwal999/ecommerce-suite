import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/common/section-header';
import { catalogApi } from '@/features/catalog/api/catalog-api';
import type { Category } from '@/features/catalog/types';
import { cn } from '@/lib/utils';

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
      <CategoryGrid categories={categories} />
    </section>
  );
}

/**
 * The category strip itself, shared by the home page and the empty cart /
 * wishlist. Phones: a swipeable row. Desktop: evenly spaced columns. Every
 * image is the same size whatever its label, and labels get a fixed two-line
 * slot so the images stay in one row.
 */
export function CategoryGrid({
  categories,
  shape = 'circle',
}: {
  categories: Category[];
  /** `circle` on the home page; `squircle` (rounded square) for the empty-state explorer. */
  shape?: 'circle' | 'squircle';
}) {
  return (
    <ul className="rail -mx-4 gap-3 px-4 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(104px,1fr))] md:gap-x-4 md:gap-y-6 md:overflow-visible md:px-0">
      {categories.map((category) => (
        <li key={category.id} className="w-[76px] md:w-auto">
          <Link href={`/c/${category.slug}`} className="group flex flex-col items-center gap-2 text-center">
            <span
              className={cn(
                'bg-secondary relative block size-[72px] overflow-hidden ring-1 ring-border transition-shadow group-hover:shadow-[0_8px_24px_oklch(0.42_0.21_330/0.18)] md:size-auto md:aspect-square md:w-full md:max-w-[112px]',
                shape === 'circle' ? 'rounded-full' : 'rounded-[28%]',
              )}
            >
              <Image
                src={category.imageUrl}
                alt={category.name}
                fill
                sizes="(min-width: 768px) 112px, 72px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.06]"
              />
            </span>
            <span className="line-clamp-2 min-h-[2lh] text-xs leading-tight font-semibold md:text-[13px]">
              {category.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loading fallback for <Suspense>, dimensioned to match the real layout 1:1
 *  so content never shifts when it swaps in. */
export function CategoryTilesSkeleton() {
  return (
    <div className="container pt-6 md:pt-10">
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-[repeat(auto-fit,minmax(104px,1fr))] md:gap-x-4">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex w-[76px] shrink-0 flex-col items-center gap-2 md:w-auto">
            <Skeleton className="size-[72px] rounded-full md:size-auto md:aspect-square md:w-full md:max-w-[112px]" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
