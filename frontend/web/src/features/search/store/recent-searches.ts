import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT = 8;

interface RecentSearchesState {
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

/**
 * The shopper's own recent searches, newest first, on this device only - the
 * Flipkart/Meesho "Recent searches" list. De-duplicated case-insensitively so
 * "Lamps" and "lamps" are one entry.
 */
export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      terms: [],
      add: (raw) => {
        const term = raw.trim().replace(/\s+/g, ' ');
        if (term.length < 2) return;
        set((state) => ({
          terms: [term, ...state.terms.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT),
        }));
      },
      remove: (term) => set((state) => ({ terms: state.terms.filter((item) => item !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'recent-searches' },
  ),
);
