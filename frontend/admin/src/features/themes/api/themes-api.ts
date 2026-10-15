import { api, endpoints } from '@/lib/api';
import type { StoreTheme, ThemeInput } from '../types';

export const themesApi = {
  list: () => api.get<StoreTheme[]>(endpoints.admin.themes),

  /** What the storefront is wearing right now (null = everyday skin). */
  live: () => api.get<StoreTheme | null>(endpoints.catalog.liveTheme),

  create: (input: ThemeInput) => api.post<StoreTheme>(endpoints.admin.themes, input),

  update: (themeId: string, input: Partial<ThemeInput>) =>
    api.patch<StoreTheme>(endpoints.admin.theme(themeId), input),

  remove: (themeId: string) => api.delete<{ ok: true }>(endpoints.admin.theme(themeId)),
};
