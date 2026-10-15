import { create } from 'zustand';

/**
 * Ephemeral, cross-feature UI state. Anything that must survive a reload
 * (cart, location) belongs in a persisted store instead.
 */
interface UiState {
  isCartOpen: boolean;
  isSearchOpen: boolean;
  isMobileNavOpen: boolean;
  /** The OTP login dialog can be summoned from any screen (header, checkout, wishlist). */
  isLoginOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setSearchOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  openLogin: () => void;
  closeLogin: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCartOpen: false,
  isSearchOpen: false,
  isMobileNavOpen: false,
  isLoginOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),
  openLogin: () => set({ isLoginOpen: true }),
  closeLogin: () => set({ isLoginOpen: false }),
}));
