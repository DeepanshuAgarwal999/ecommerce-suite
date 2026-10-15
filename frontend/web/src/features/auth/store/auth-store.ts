import { create } from 'zustand';
import type { SessionUser } from '../types';

interface AuthState {
  /**
   * Short-lived bearer token, memory only. The gateway keeps the refresh token
   * in an httpOnly cookie for browsers (AuthCookieService), so a reload restores
   * the session by calling /auth/refresh rather than by reading storage — a
   * token JavaScript can read is a token XSS can steal.
   */
  accessToken: string | null;
  expiresAt: number | null;
  user: SessionUser | null;
  /** False until the boot-time refresh attempt has settled. */
  isRestoring: boolean;
  setSession: (accessToken: string, expiresIn: number, user?: SessionUser) => void;
  setUser: (user: SessionUser) => void;
  setRestoring: (isRestoring: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  expiresAt: null,
  user: null,
  isRestoring: true,
  setSession: (accessToken, expiresIn, user) =>
    set((state) => ({
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      user: user ?? state.user,
      isRestoring: false,
    })),
  setUser: (user) => set({ user }),
  setRestoring: (isRestoring) => set({ isRestoring }),
  clearSession: () =>
    set({ accessToken: null, expiresAt: null, user: null, isRestoring: false }),
}));

export const selectIsSignedIn = (state: AuthState) => Boolean(state.accessToken);
