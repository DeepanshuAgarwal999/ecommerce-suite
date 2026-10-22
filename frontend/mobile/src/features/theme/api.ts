import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/lib/api';
import type { StoreTheme } from './types';

/**
 * The occasion theme live right now, or null for the everyday skin. A failure is
 * "no theme": festive decoration is never a reason for a screen to error.
 */
async function fetchActiveTheme(): Promise<StoreTheme | null> {
  try {
    return await api.get<StoreTheme | null>(endpoints.home.theme, { timeoutMs: 6_000 });
  } catch {
    return null;
  }
}

export function useActiveTheme() {
  return useQuery({
    queryKey: ['home', 'theme'],
    queryFn: fetchActiveTheme,
    staleTime: 5 * 60_000,
  });
}
