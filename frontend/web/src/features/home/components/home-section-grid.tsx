import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { homeApi } from '../api/home-api';
import type { CmsHomeSection } from '../cms-types';
import { DealOfDaySection } from './sections/deal-of-day-section';
import { ProductGridSection } from './sections/product-grid-section';
import { ProductTabsSection } from './sections/product-tabs-section';
import { SplitBannersSection } from './sections/split-banners-section';
import { TileGridSection } from './sections/tile-grid-section';

/**
 * One admin-curated section, rendered by its layout. Unknown layouts (a newer
 * backend than this storefront) render nothing rather than guessing.
 */
export function HomeSection({ section }: { section: CmsHomeSection }) {
  switch (section.layout) {
    case 'SPLIT_BANNERS':
      return <SplitBannersSection section={section} />;
    case 'PRODUCT_GRID':
      return <ProductGridSection section={section} />;
    case 'PRODUCT_TABS':
      return <ProductTabsSection section={section} />;
    case 'DEAL_OF_DAY':
      return <DealOfDaySection section={section} />;
    case 'TILE_GRID':
    case undefined:
      return <TileGridSection section={section} />;
    default:
      return null;
  }
}

/**
 * Renders every active section the CMS returns, in the order admin set -
 * including occasion sections, which the backend only returns while their
 * theme is live.
 *
 * Self-contained like `ProductRail`: fetches its own data and renders nothing
 * on failure, so any page can drop in `<Suspense><HomeSections /></Suspense>`
 * with no data-fetching of its own to wire up.
 */
export async function HomeSections() {
  let sections: CmsHomeSection[];
  try {
    sections = await homeApi.sections({ next: { revalidate: 120 } });
  } catch {
    return null;
  }

  // Product-backed layouts fetch again; a Suspense each keeps one slow
  // category query from holding back every section below it.
  return (
    <>
      {sections.map((section) => (
        <Suspense key={section.id} fallback={<HomeSectionsSkeleton />}>
          <HomeSection section={section} />
        </Suspense>
      ))}
    </>
  );
}

/** Loading fallback for <Suspense>, dimensioned to match one shelf 1:1 so
 *  content never shifts when it swaps in - the real count isn't knowable
 *  until the fetch resolves, so this approximates a single section. */
export function HomeSectionsSkeleton() {
  return (
    <div className="container pt-8 md:pt-14">
      <Skeleton className="mb-3 h-5 w-44" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="w-[104px] shrink-0 md:w-auto">
            <Skeleton className="aspect-square w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
