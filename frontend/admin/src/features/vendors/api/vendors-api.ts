import { api, endpoints } from '@/lib/api';
import type { Paginated } from '@/types/pagination';
import type { ReviewVendorInput, VendorListQuery, VendorStatus, VendorWithUser } from '../types';

export const vendorsApi = {
  list: (query: VendorListQuery) =>
    api.get<Paginated<VendorWithUser>>(endpoints.admin.vendors, { searchParams: { ...query } }),

  get: (vendorId: string) => api.get<VendorWithUser>(endpoints.admin.vendor(vendorId)),

  review: (vendorId: string, input: ReviewVendorInput) =>
    api.post<VendorWithUser>(endpoints.admin.vendorReview(vendorId), input),

  /** Count for one status, read off the pagination total rather than a dedicated endpoint. */
  count: (status?: VendorListQuery['status']) =>
    api
      .get<Paginated<VendorWithUser>>(endpoints.admin.vendors, {
        searchParams: { status, limit: 1 },
      })
      .then((result) => result.meta.total),

  /** Every status's count in one request — what the dashboard actually wants,
   *  instead of calling `count()` once per status. */
  summary: () => api.get<{ status: VendorStatus; count: number }[]>(endpoints.admin.vendorsSummary),
};
