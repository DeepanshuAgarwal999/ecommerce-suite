import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

export interface DeliveryLocation {
  pincode: string;
  /** Short line under "Delivering to": locality, or the saved address name. */
  label: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  /** Set when picked from the address book - checkout preselects it. */
  addressId?: string;
}

interface LocationState {
  location: DeliveryLocation | null;
  setLocation: (location: DeliveryLocation) => void;
  clearLocation: () => void;
}

/** Same contract as the web's location store: picked once, persisted. */
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),
      clearLocation: () => set({ location: null }),
    }),
    { name: 'delivery-location', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);
