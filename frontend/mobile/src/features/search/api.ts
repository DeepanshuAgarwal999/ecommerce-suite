import { useQuery } from '@tanstack/react-query';
import { api, endpoints, queryKeys } from '@/lib/api';
import type { Suggestions } from './types';

export const searchApi = {
  suggest: (q: string, signal?: AbortSignal) =>
    api.get<Suggestions>(endpoints.search.suggest, { searchParams: { q }, signal, timeoutMs: 6_000 }),
};

/** Type-ahead. Keystrokes cancel the previous request through React Query's signal. */
export function useSuggestions(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: queryKeys.search.suggestions(q),
    queryFn: ({ signal }) => searchApi.suggest(q, signal),
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
