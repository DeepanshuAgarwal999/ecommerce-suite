'use client';

import { PackageSearch, WifiOff } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { useInfiniteProducts } from '../hooks/use-products';
import type { ProductQuery } from '../types';
import { ProductGrid, ProductGridSkeleton } from './product-grid';

interface ProductFeedProps {
  query: Omit<ProductQuery, 'page'>;
  emptyTitle?: string;
}

/** Infinite product listing for category and search pages. */
export function ProductFeed({ query, emptyTitle = 'Nothing here yet' }: ProductFeedProps) {
  const feed = useInfiniteProducts(query);

  if (feed.isPending) return <ProductGridSkeleton />;

  if (feed.isError) {
    const offline = !isApiError(feed.error);
    return (
      <EmptyState
        icon={WifiOff}
        title={offline ? 'We could not reach the store' : 'Something went wrong'}
        description={
          offline
            ? 'Check your connection and try again.'
            : feed.error.message
        }
        action={
          <Button variant="outline" onClick={() => feed.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const products = feed.data.pages.flatMap((page) => page.items);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={emptyTitle}
        description="Try a different category or a broader search."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProductGrid products={products} />
      {feed.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
