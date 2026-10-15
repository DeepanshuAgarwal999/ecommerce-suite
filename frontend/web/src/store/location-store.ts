import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeliveryLocation {
  pincode: string;
  label: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface LocationState {
  location: DeliveryLocation | null;
  /** Serviceability is resolved against the inventory service per pincode. */
  isServiceable: boolean;
  etaMinutes: number | null;
  setLocation: (location: DeliveryLocation) => void;
  setServiceability: (isServiceable: boolean, etaMinutes: number | null) => void;
  clearLocation: () => void;
}

/**
 * The delivery pincode gates price, stock and ETA on every product surface, so
 * it is picked once and persisted — re-asking on each visit is the fastest way
 * to lose a session.
 */
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      isServiceable: false,
      etaMinutes: null,
      setLocation: (location) => set({ location }),
      setServiceability: (isServiceable, etaMinutes) =>
        set({ isServiceable, etaMinutes }),
      clearLocation: () =>
        set({ location: null, isServiceable: false, etaMinutes: null }),
    }),
    {
      name: 'delivery-location',
      partialize: (state) => ({ location: state.location }),
    },
  ),
);
