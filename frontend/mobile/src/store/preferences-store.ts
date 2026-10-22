import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

export type Appearance = 'system' | 'light' | 'dark';

interface PreferencesState {
  appearance: Appearance;
  /** Haptic ticks on add-to-cart, steppers and tab switches. */
  haptics: boolean;
  setAppearance: (appearance: Appearance) => void;
  setHaptics: (enabled: boolean) => void;
}

/** Device-level settings the shopper controls from Account -> Settings. */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      appearance: 'system',
      haptics: true,
      setAppearance: (appearance) => set({ appearance }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    { name: 'preferences', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);
