import { api, endpoints } from '@/lib/api';
import type { Address, AddressInput, PincodeInfo, ReverseGeocode } from '../types';

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
