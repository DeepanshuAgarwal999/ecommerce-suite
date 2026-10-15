'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { homeSectionsApi, type ReorderInput } from '../api/home-sections-api';
import type { HomeSection, HomeSectionInput, SectionTileInput } from '../types';

export function useHomeSections() {
  return useQuery({
    queryKey: queryKeys.homeSections.list(),
    queryFn: homeSectionsApi.list,
  });
}

function useInvalidateSections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.homeSections.all });
}

export function useCreateSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (input: HomeSectionInput) => homeSectionsApi.create(input),
    onSuccess: () => {
      invalidate();
      toast.success('Section created.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not create the section.'),
  });
}

export function useUpdateSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HomeSectionInput> }) =>
      homeSectionsApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Section updated.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the section.'),
  });
}

export function useDeleteSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (id: string) => homeSectionsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Section removed.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove the section.'),
  });
}

export function useReorderSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderInput) => homeSectionsApi.reorder(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.homeSections.list() });
      const previous = queryClient.getQueryData<HomeSection[]>(queryKeys.homeSections.list());

      if (previous) {
        const order = new Map(input.items.map((item) => [item.id, item.displayOrder]));
        const next = [...previous].sort(
          (a, b) => (order.get(a.id) ?? a.displayOrder) - (order.get(b.id) ?? b.displayOrder),
        );
        queryClient.setQueryData(queryKeys.homeSections.list(), next);
      }

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.homeSections.list(), context.previous);
      toast.error(isApiError(error) ? error.message : 'Could not save the new order.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.homeSections.all }),
  });
}

export function useCreateTile(sectionId: string) {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (input: SectionTileInput) => homeSectionsApi.createTile(sectionId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Tile added.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not add the tile.'),
  });
}

export function useUpdateTile(sectionId: string) {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: ({ tileId, input }: { tileId: string; input: Partial<SectionTileInput> }) =>
      homeSectionsApi.updateTile(sectionId, tileId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Tile updated.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the tile.'),
  });
}

export function useDeleteTile(sectionId: string) {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (tileId: string) => homeSectionsApi.removeTile(sectionId, tileId),
    onSuccess: () => {
      invalidate();
      toast.success('Tile removed.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove the tile.'),
  });
}

export function useReorderTiles(sectionId: string) {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (input: ReorderInput) => homeSectionsApi.reorderTiles(sectionId, input),
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not save the new order.'),
    onSettled: () => invalidate(),
  });
}
