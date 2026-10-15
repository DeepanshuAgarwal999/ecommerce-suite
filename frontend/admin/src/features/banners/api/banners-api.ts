import { api, endpoints } from '@/lib/api';
import type { Banner, BannerInput } from '../types';

export interface ReorderInput {
  items: { id: string; displayOrder: number }[];
}

export const bannersApi = {
  list: () => api.get<Banner[]>(endpoints.admin.banners),

  create: (input: BannerInput) => api.post<Banner>(endpoints.admin.banners, input),

  update: (bannerId: string, input: Partial<BannerInput>) =>
    api.patch<Banner>(endpoints.admin.banner(bannerId), input),

  remove: (bannerId: string) => api.delete<{ ok: true }>(endpoints.admin.banner(bannerId)),

  reorder: (input: ReorderInput) => api.post<Banner[]>(endpoints.admin.reorderBanners, input),
};
