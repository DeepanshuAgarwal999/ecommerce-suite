'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';
import { Button } from '@/components/ui/button';
import { catalogApi } from '../api/catalog-api';
import { ReviewForm } from './review-form';
import { ReviewList } from './review-list';
import { Stars } from './stars';

/**
 * Ratings + reviews for the product page.
 * Everyone sees published reviews; the write form unlocks only for buyers
 * with a delivered order containing this product.
 */
export function ProductReviews({
  productId,
  ratingAverage,
  ratingCount,
}: {
  productId: string;
  ratingAverage: number;
  ratingCount: number;
}) {
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();

  const reviewsQuery = useQuery({
    queryKey: [...queryKeys.catalog.all, 'reviews', productId, ratingFilter],
    queryFn: () => catalogApi.listReviews(productId, { rating: ratingFilter }),
  });

  const breakdown = reviewsQuery.data?.breakdown ?? [];
  const items = reviewsQuery.data?.items ?? [];

  return (
    <section className="container pb-10" aria-label="Ratings and reviews">
      <h2 className="text-lg font-extrabold">Ratings & Reviews</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold">{ratingAverage.toFixed(1)}</span>
          <Stars value={Math.round(ratingAverage)} size="size-4" />
          <span className="text-muted-foreground text-sm">({ratingCount})</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={ratingFilter === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRatingFilter(undefined)}
          >
            All
          </Button>
          {breakdown.map((row) => (
            <Button
              key={row.rating}
              variant={ratingFilter === row.rating ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRatingFilter(row.rating === ratingFilter ? undefined : row.rating)}
            >
              {row.rating}★ ({row.count})
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {reviewsQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading reviews…</p>
        ) : reviewsQuery.isError ? (
          <p className="text-muted-foreground text-sm">Could not load reviews right now.</p>
        ) : (
          <ReviewList items={items} />
        )}
      </div>
      <div className="mt-6 rounded-xl border p-4">
        <h3 className="text-base font-extrabold">Write a review</h3>
        <ReviewForm productId={productId} />
      </div>
    </section>
  );
}
