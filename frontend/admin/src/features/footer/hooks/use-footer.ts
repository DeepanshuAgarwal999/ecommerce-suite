'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { footerApi, type ReorderInput } from '../api/footer-api';
import type {
  FooterAdminData,
  FooterColumn,
  FooterColumnInput,
  FooterLinkInput,
  FooterSettingsInput,
} from '../types';

export function useFooter() {
  return useQuery({
    queryKey: queryKeys.footer.list(),
    queryFn: footerApi.list,
  });
}

function useInvalidateFooter() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.footer.all });
}

export function useCreateColumn() {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (input: FooterColumnInput) => footerApi.createColumn(input),
    onSuccess: () => {
      invalidate();
      toast.success('Column created.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not create the column.'),
  });
}

export function useUpdateColumn() {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<FooterColumnInput> }) =>
      footerApi.updateColumn(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Column updated.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the column.'),
  });
}

export function useDeleteColumn() {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (id: string) => footerApi.removeColumn(id),
    onSuccess: () => {
      invalidate();
      toast.success('Column removed.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove the column.'),
  });
}

export function useReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderInput) => footerApi.reorderColumns(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.footer.list() });
      const previous = queryClient.getQueryData<FooterAdminData>(queryKeys.footer.list());

      if (previous) {
        const order = new Map(input.items.map((item) => [item.id, item.displayOrder]));
        const columns: FooterColumn[] = [...previous.columns].sort(
          (a, b) => (order.get(a.id) ?? a.displayOrder) - (order.get(b.id) ?? b.displayOrder),
        );
        queryClient.setQueryData(queryKeys.footer.list(), { ...previous, columns });
      }

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.footer.list(), context.previous);
      toast.error(isApiError(error) ? error.message : 'Could not save the new order.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.footer.all }),
  });
}

export function useCreateLink(columnId: string) {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (input: FooterLinkInput) => footerApi.createLink(columnId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Link added.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not add the link.'),
  });
}

export function useUpdateLink(columnId: string) {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; input: Partial<FooterLinkInput> }) =>
      footerApi.updateLink(columnId, linkId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Link updated.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the link.'),
  });
}

export function useDeleteLink(columnId: string) {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (linkId: string) => footerApi.removeLink(columnId, linkId),
    onSuccess: () => {
      invalidate();
      toast.success('Link removed.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove the link.'),
  });
}

export function useReorderLinks(columnId: string) {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (input: ReorderInput) => footerApi.reorderLinks(columnId, input),
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not save the new order.'),
    onSettled: () => invalidate(),
  });
}

export function useUpdateFooterSettings() {
  const invalidate = useInvalidateFooter();
  return useMutation({
    mutationFn: (input: FooterSettingsInput) => footerApi.updateSettings(input),
    onSuccess: () => {
      invalidate();
      toast.success('Footer settings saved.');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not save footer settings.'),
  });
}
