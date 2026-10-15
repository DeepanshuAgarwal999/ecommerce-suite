import { api, endpoints } from '@/lib/api';

export interface ResetCacheResult {
  deletedKeys: number;
}

/** Mirrors apps/api-gateway admin.controller's settings routes. */
export const settingsApi = {
  resetCache: () => api.post<ResetCacheResult>(endpoints.admin.resetCache),
};
