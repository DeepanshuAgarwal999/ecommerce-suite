import { create } from 'zustand';
import { registerAuthBridge } from '@/lib/api/auth-bridge';
import { secureToken } from '@/lib/secure-token';
import type { SessionUser, TokenPair } from './types';

type Status = 'restoring' | 'signedIn' | 'signedOut';

interface AuthState {
  /** Short-lived bearer token, memory only. The refresh token is in secure storage. */
  accessToken: string | null;
  expiresAt: number | null;
  user: SessionUser | null;
  status: Status;
  /** Store a fresh pair: access token in memory, refresh token in the Keychain/Keystore. */
  setTokens: (tokens: TokenPair, user?: SessionUser) => Promise<void>;
  setUser: (user: SessionUser) => void;
  markSignedOut: () => void;
  signOutLocally: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  expiresAt: null,
  user: null,
  status: 'restoring',

  setTokens: async (tokens, user) => {
    // Persist before exposing the access token: if the app dies between the two,
    // the next launch still holds the rotated refresh token, not the spent one.
    if (tokens.refreshToken) await secureToken.setRefreshToken(tokens.refreshToken);
    set((state) => ({
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      user: user ?? state.user,
      status: 'signedIn',
    }));
  },

  setUser: (user) => set({ user }),

  markSignedOut: () => set({ accessToken: null, expiresAt: null, user: null, status: 'signedOut' }),

  signOutLocally: async () => {
    await secureToken.clear();
    set({ accessToken: null, expiresAt: null, user: null, status: 'signedOut' });
  },
}));

export const selectIsSignedIn = (state: AuthState) => state.status === 'signedIn';

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onRefreshed: (tokens) => useAuthStore.getState().setTokens(tokens),
  onRefreshFailed: () => useAuthStore.getState().markSignedOut(),
});
