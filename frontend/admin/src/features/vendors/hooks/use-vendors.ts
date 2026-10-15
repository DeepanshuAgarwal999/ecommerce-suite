'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { vendorsApi } from '../api/vendors-api';
import type { ReviewVendorInput, VendorListQuery } from '../types';

export function useVendors(query: VendorListQuery) {
  return useQuery({
    queryKey: queryKeys.vendors.list({ ...query }),
    queryFn: () => vendorsApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useVendor(vendorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(vendorId ?? ''),
    queryFn: () => vendorsApi.get(vendorId as string),
    enabled: Boolean(vendorId),
  });
}

export function useReviewVendor(vendorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewVendorInput) => vendorsApi.review(vendorId, input),
    onSuccess: (vendor) => {
      queryClient.setQueryData(queryKeys.vendors.detail(vendorId), vendor);
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      toast.success(
        vendor.status === 'APPROVED'
          ? `${vendor.businessName} approved — the VENDOR role is granted automatically.`
          : `${vendor.businessName} marked ${vendor.status.toLowerCase()}.`,
      );
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not update the vendor.');
    },
  });
}
