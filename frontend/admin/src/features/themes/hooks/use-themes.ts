'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { themesApi } from '../api/themes-api';
import type { ThemeInput } from '../types';

export function useThemes() {
  return useQuery({ queryKey: queryKeys.themes.list(), queryFn: themesApi.list });
}

export function useLiveTheme() {
  return useQuery({ queryKey: queryKeys.themes.live(), queryFn: themesApi.live });
}

function useInvalidateThemes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.themes.all });
}

export function useCreateTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: (input: ThemeInput) => themesApi.create(input),
    onSuccess: () => {
      invalidate();
      toast.success('Theme created.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not create the theme.'),
  });
}

export function useUpdateTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ThemeInput> }) => themesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Theme saved. The storefront picks it up within a couple of minutes.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the theme.'),
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => themesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.themes.all });
      // Banners/sections tied to it fall back to "always" server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.homeSections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.banners.all });
      toast.success('Theme deleted.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not delete the theme.'),
  });
}
