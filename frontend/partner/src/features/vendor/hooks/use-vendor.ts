'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError, queryKeys } from '@/lib/api';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { vendorApi } from '../api/vendor-api';
import type { ApplyVendorInput } from '../types';

/**
 * The caller's seller profile, if any. A 404 is the normal "has not applied
 * yet" state, not an error — it resolves to `vendor: null` rather than
 * surfacing a fetch failure on every fresh account.
 */
export function useVendor() {
  const signedIn = useIsSignedIn();

  const query = useQuery({
    queryKey: queryKeys.vendor.me(),
    queryFn: async () => {
      try {
        return await vendorApi.me();
      } catch (error) {
        if (isApiError(error) && error.isNotFound) return null;
        throw error;
      }
    },
    enabled: signedIn,
    staleTime: 30_000,
  });

  return { ...query, vendor: query.data ?? null };
}

export function useApplyVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyVendorInput) => vendorApi.apply(input),
    onSuccess: (vendor) => {
      queryClient.setQueryData(queryKeys.vendor.me(), vendor);
    },
  });
}
