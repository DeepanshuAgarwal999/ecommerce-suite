'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { queryKeys } from '@/lib/api';
import { searchApi } from '../api/search-api';

export const MIN_SUGGEST_LENGTH = 2;

/**
 * Type-ahead for the search box. Debounced 180ms so a fast typist sends one
 * request per pause, not per key; superseded requests are aborted (`signal`);
 * the previous list stays on screen while the next loads, so the dropdown
 * never flickers empty between keystrokes.
 */
export function useSuggestions(term: string) {
  const debounced = useDebouncedValue(term.trim().toLowerCase(), 180);
  const enabled = debounced.length >= MIN_SUGGEST_LENGTH;

  return useQuery({
    queryKey: queryKeys.search.suggestions(debounced),
    queryFn: ({ signal }) => searchApi.suggest(debounced, signal),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
