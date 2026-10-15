import { api, endpoints } from '@/lib/api';
import type { CmsBanner, CmsHomeSection } from '../cms-types';

/** Transport for the admin-managed home page CMS. Public, unauthenticated reads. */
export const homeApi = {
  banners: (init?: RequestInit) => api.get<CmsBanner[]>(endpoints.home.banners, init),

  sections: (init?: RequestInit) => api.get<CmsHomeSection[]>(endpoints.home.sections, init),
};
