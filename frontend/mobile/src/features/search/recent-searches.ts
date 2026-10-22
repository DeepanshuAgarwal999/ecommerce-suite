import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

const MAX = 8;

interface RecentSearchesState {
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

/** Last few searches, most recent first, de-duplicated case-insensitively. */
export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) =>
        set((state) => {
          const clean = term.trim();
          if (!clean) return state;
          const rest = state.terms.filter((existing) => existing.toLowerCase() !== clean.toLowerCase());
          return { terms: [clean, ...rest].slice(0, MAX) };
        }),
      remove: (term) => set((state) => ({ terms: state.terms.filter((existing) => existing !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'recent-searches', storage: createJSONStorage(() => zustandStorage), version: 1 },
  ),
);
