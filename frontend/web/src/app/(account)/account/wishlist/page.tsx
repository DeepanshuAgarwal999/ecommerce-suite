import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WishlistView } from '@/features/wishlist/components/wishlist-view';
import {
  ExploreCategories,
  ExploreCategoriesSkeleton,
} from '@/features/home/components/explore-categories';

export const metadata: Metadata = { title: 'Wishlist' };

export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold md:text-[32px]">Wishlist</h1>
      <WishlistView
        emptyExtra={
          <Suspense fallback={<ExploreCategoriesSkeleton />}>
            <ExploreCategories />
          </Suspense>
        }
      />
    </div>
  );
}
