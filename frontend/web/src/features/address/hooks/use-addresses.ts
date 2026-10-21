'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { isApiError, queryKeys } from '@/lib/api';
import { addressApi } from '../api/address-api';
import type { Address, AddressInput } from '../types';

export function useAddresses() {
  const isSignedIn = useIsSignedIn();
  return useQuery({ queryKey: queryKeys.addresses.list(), queryFn: addressApi.list, enabled: isSignedIn });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
}

const message = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

export function useSaveAddress() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AddressInput }) =>
      id ? addressApi.update(id, input) : addressApi.create(input),
    onSuccess: (_address, { id }) => {
      invalidate();
      toast.success(id ? 'Address updated' : 'Address saved');
    },
    onError: (error) => toast.error(message(error, 'Could not save the address.')),
  });
}

export function useDeleteAddress() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => addressApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Address removed');
    },
    onError: (error) => toast.error(message(error, 'Could not remove the address.')),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressApi.setDefault(id),
    // Optimistic: the badge moves instantly.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.addresses.list() });
      const previous = queryClient.getQueryData<Address[]>(queryKeys.addresses.list());
      if (previous) {
        queryClient.setQueryData(
          queryKeys.addresses.list(),
          previous.map((address) => ({ ...address, isDefault: address.id === id })),
        );
      }
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.addresses.list(), context.previous);
      toast.error(message(error, 'Could not change the default address.'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all }),
  });
}
