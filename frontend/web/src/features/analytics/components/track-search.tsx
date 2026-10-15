'use client';

import { useEffect } from 'react';
import { useInfiniteProducts } from '@/features/catalog/hooks/use-products';
import { firstInSession, track } from '../track';

/**
 * Records a search and how many results it found, for admin Insights ("popular
 * searches", "searches with no results"). Reads the same query the results grid
 * uses, so it costs no extra request. Once per term per session.
 */
export function TrackSearch({ term }: { term: string }) {
  const feed = useInfiniteProducts({ search: term });
  const total = feed.data?.pages[0]?.meta.total;

  useEffect(() => {
    if (total === undefined || term.trim().length < 2) return;
    if (firstInSession(`search:${term.trim().toLowerCase()}`)) track('search', { q: term, results: total });
  }, [term, total]);

  return null;
}
