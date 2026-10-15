'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { bannersApi, type ReorderInput } from '../api/banners-api';
import type { Banner, BannerInput } from '../types';

export function useBanners() {
  return useQuery({
    queryKey: queryKeys.banners.list(),
    queryFn: bannersApi.list,
  });
}

function useInvalidateBanners() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.banners.all });
}

export function useCreateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (input: BannerInput) => bannersApi.create(input),
    onSuccess: () => {
      invalidate();
      toast.success('Banner added to the carousel.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not create the banner.'),
  });
}

export function useUpdateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<BannerInput> }) =>
      bannersApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Banner updated.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the banner.'),
  });
}

export function useDeleteBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (id: string) => bannersApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Banner removed.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove the banner.'),
  });
}

/** Optimistic: the up/down buttons should feel instant, not wait on a round trip. */
export function useReorderBanners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderInput) => bannersApi.reorder(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.banners.list() });
      const previous = queryClient.getQueryData<Banner[]>(queryKeys.banners.list());

      if (previous) {
        const order = new Map(input.items.map((item) => [item.id, item.displayOrder]));
        const next = [...previous].sort(
          (a, b) => (order.get(a.id) ?? a.displayOrder) - (order.get(b.id) ?? b.displayOrder),
        );
        queryClient.setQueryData(queryKeys.banners.list(), next);
      }

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.banners.list(), context.previous);
      toast.error(isApiError(error) ? error.message : 'Could not save the new order.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.banners.all }),
  });
}
