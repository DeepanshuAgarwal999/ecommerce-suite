import { api, endpoints } from '@/lib/api';
import type { ApplyVendorInput, Vendor } from '../types';

/** Mirrors apps/api-gateway vendor.controller's account-level routes. */
export const vendorApi = {
  apply: (input: ApplyVendorInput) => api.post<Vendor>(endpoints.vendor.apply, input),
  me: () => api.get<Vendor>(endpoints.vendor.me),
};
