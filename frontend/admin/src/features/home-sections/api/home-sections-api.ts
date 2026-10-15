import { api, endpoints } from '@/lib/api';
import type { HomeSection, HomeSectionInput, SectionTile, SectionTileInput } from '../types';

export interface ReorderInput {
  items: { id: string; displayOrder: number }[];
}

export const homeSectionsApi = {
  list: () => api.get<HomeSection[]>(endpoints.admin.homeSections),

  create: (input: HomeSectionInput) => api.post<HomeSection>(endpoints.admin.homeSections, input),

  update: (sectionId: string, input: Partial<HomeSectionInput>) =>
    api.patch<HomeSection>(endpoints.admin.homeSection(sectionId), input),

  remove: (sectionId: string) =>
    api.delete<{ ok: true }>(endpoints.admin.homeSection(sectionId)),

  reorder: (input: ReorderInput) => api.post<HomeSection[]>(endpoints.admin.reorderHomeSections, input),

  createTile: (sectionId: string, input: SectionTileInput) =>
    api.post<SectionTile>(endpoints.admin.sectionTiles(sectionId), input),

  updateTile: (sectionId: string, tileId: string, input: Partial<SectionTileInput>) =>
    api.patch<SectionTile>(endpoints.admin.sectionTile(sectionId, tileId), input),

  removeTile: (sectionId: string, tileId: string) =>
    api.delete<{ ok: true }>(endpoints.admin.sectionTile(sectionId, tileId)),

  reorderTiles: (sectionId: string, input: ReorderInput) =>
    api.post<HomeSection>(endpoints.admin.reorderSectionTiles(sectionId), input),
};
