import { Suspense } from 'react';
import {
  CategoryTiles,
  CategoryTilesSkeleton,
  HeroCarousel,
  HomeSections,
  HomeSectionsSkeleton,
  ProductRail,
  ProductRailSkeleton,
  UspStrip,
  heroSlides,
  homeApi,
  toHeroSlide,
  usps,
} from '@/features/home';

/**
 * Banners are the LCP element - above the fold - so they stay in the blocking
 * part of the render and SSR immediately. Must never go blank because this
 * content is empty or the service is briefly unreachable - falls back to the
 * static `heroSlides` set.
 *
 * Everything below the hero is a self-contained section (CategoryTiles,
 * ProductRail, HomeSections) that fetches its own data and ships its own
 * matching skeleton - see their definitions in features/home/components.
 * Wrapping each in its own <Suspense> lets the shell stream to the browser
 * immediately instead of waiting on the slowest of five backend calls, and
 * means a slow or failing section no longer blocks the others.
 */
async function getHeroSlides() {
  try {
    const banners = await homeApi.banners({ next: { revalidate: 120 } });
    return banners.length > 0 ? banners.map(toHeroSlide) : heroSlides;
  } catch {
    return heroSlides;
  }
}

export default async function HomePage() {
  const slides = await getHeroSlides();

  return (
    <>
      <HeroCarousel slides={slides} />
      <UspStrip usps={usps} />

      <Suspense fallback={<CategoryTilesSkeleton />}>
        <CategoryTiles />
      </Suspense>

      <Suspense fallback={<ProductRailSkeleton />}>
        <ProductRail
          title="Bestsellers"
          subtitle="What everyone is adding this week"
          href="/c/bestsellers"
          query={{ sort: 'rating' }}
        />
      </Suspense>

      {/* Admin-curated shelves - "Shop by occasion", "Trending rooms" and
          anything else configured in the console - in the order set there. */}
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections />
      </Suspense>

      <Suspense fallback={<ProductRailSkeleton />}>
        <ProductRail
          title="New arrivals"
          subtitle="Fresh from the makers"
          href="/c/new"
          query={{ sort: 'newest' }}
        />
      </Suspense>
    </>
  );
}
