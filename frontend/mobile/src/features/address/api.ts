import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { useIsSignedIn } from '@/features/auth/session';
import { api, endpoints, errorMessage, queryKeys } from '@/lib/api';
import type { Address, AddressInput, PincodeInfo, ReverseGeocode } from './types';

/** Mirrors frontend/web features/address/api. */
export const addressApi = {
  list: () => api.get<Address[]>(endpoints.address.list),
  create: (input: AddressInput) => api.post<Address>(endpoints.address.list, input),
  update: (id: string, input: Partial<AddressInput>) => api.put<Address>(endpoints.address.detail(id), input),
  remove: (id: string) => api.delete<{ ok: true }>(endpoints.address.detail(id)),
  setDefault: (id: string) => api.post<{ ok: true }>(endpoints.address.setDefault(id), {}),

  reverseGeocode: (latitude: number, longitude: number) =>
    api.get<ReverseGeocode>(endpoints.geo.reverse, { searchParams: { lat: latitude, lng: longitude } }),
  pincode: (pincode: string) => api.get<PincodeInfo>(endpoints.geo.pincode(pincode)),
};

export function useAddresses() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: queryKeys.addresses.list(), queryFn: addressApi.list, enabled: signedIn, staleTime: 60_000 });
}

/** The address checkout should preselect: the shopper's pick, else the default, else the newest. */
export function pickAddress(addresses: Address[] | undefined, preferredId: string | null | undefined): Address | null {
  if (!addresses || addresses.length === 0) return null;
  return (
    addresses.find((address) => address.id === preferredId) ??
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null
  );
}

export function useSaveAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AddressInput }) =>
      id ? addressApi.update(id, input) : addressApi.create(input),
    onSuccess: (_address, { id }) => {
      void client.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success(id ? 'Address updated' : 'Address saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save the address.')),
  });
}

export function useDeleteAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success('Address removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove the address.')),
  });
}

export function useSetDefaultAddress() {
  const client = useQueryClient();
  const key = queryKeys.addresses.list();
  return useMutation({
    mutationFn: (id: string) => addressApi.setDefault(id),
    // Optimistic: the badge moves instantly.
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Address[]>(key);
      if (previous) client.setQueryData(key, previous.map((address) => ({ ...address, isDefault: address.id === id })));
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast.error(errorMessage(error, 'Could not change the default address.'));
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.addresses.all }),
  });
}
