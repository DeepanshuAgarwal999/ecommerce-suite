import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/lib/api';
import type { CmsBanner, CmsHomeSection } from './cms-types';

/** Transport for the admin-managed home page CMS. Public, unauthenticated reads. */
export const homeApi = {
  banners: (signal?: AbortSignal) => api.get<CmsBanner[]>(endpoints.home.banners, { signal }),
  sections: (signal?: AbortSignal) => api.get<CmsHomeSection[]>(endpoints.home.sections, { signal }),
};

export const homeKeys = {
  banners: ['home', 'banners'] as const,
  sections: ['home', 'sections'] as const,
};

export function useBanners() {
  return useQuery({
    queryKey: homeKeys.banners,
    queryFn: ({ signal }) => homeApi.banners(signal),
    staleTime: 2 * 60_000,
  });
}

export function useHomeSections() {
  return useQuery({
    queryKey: homeKeys.sections,
    queryFn: ({ signal }) => homeApi.sections(signal),
    staleTime: 2 * 60_000,
  });
}
