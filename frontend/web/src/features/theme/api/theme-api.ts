import { cache } from 'react';
import { api, endpoints } from '@/lib/api';
import type { StoreTheme } from '../types';

/**
 * The occasion theme live right now, or null for the everyday skin.
 *
 * Wrapped in React `cache()` because the root layout, the announcement bar and
 * the home sections all ask for it during one render - one request, not three.
 * A failure is treated as "no theme": a festive skin is decoration, never a
 * reason for a page to error.
 */
export const getActiveTheme = cache(async (): Promise<StoreTheme | null> => {
  try {
    return await api.get<StoreTheme | null>(endpoints.home.theme, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
});
