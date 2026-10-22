import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { unregisterFromPush } from '@/features/notifications/push';
import { refreshSession } from '@/lib/api/client';
import { secureToken } from '@/lib/secure-token';
import { authApi } from './api';
import { selectIsSignedIn, useAuthStore } from './store';

/**
 * Cold-start session restore: no refresh token -> signed out immediately (no
 * spinner); otherwise rotate it and load the profile. Offline at launch keeps
 * the stored token and shows the app signed-out-for-now; the next authed call
 * refreshes again once the network is back.
 */
export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  const stored = await secureToken.getRefreshToken();
  if (!stored) {
    store.markSignedOut();
    return;
  }
  const ok = await refreshSession();
  if (!ok) {
    if (useAuthStore.getState().status === 'restoring') store.markSignedOut();
    return;
  }
  try {
    store.setUser(await authApi.me());
  } catch {
    // Profile is cosmetic at boot; screens that need it refetch.
  }
}

export function useIsSignedIn(): boolean {
  return useAuthStore(selectIsSignedIn);
}

/**
 * Runs `action` when signed in, otherwise opens the login sheet - the mobile
 * twin of the web's useRequireAuth. The login screen returns to the caller.
 */
export function useRequireAuth() {
  const router = useRouter();
  return useCallback(
    (action: () => void) => {
      if (selectIsSignedIn(useAuthStore.getState())) action();
      else router.push('/login');
    },
    [router],
  );
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    // Best effort, in this order while the access token still works: stop pushes to
    // this device for this account, then end the server session. Neither may block
    // local sign-out.
    await unregisterFromPush();
    await authApi.logout().catch(() => undefined);
    await useAuthStore.getState().signOutLocally();
    // Personal data (orders, addresses, wishlist) must not survive into the next account.
    queryClient.removeQueries({ predicate: (query) => !['catalog', 'home', 'search'].includes(String(query.queryKey[0])) });
  }, [queryClient]);
}
