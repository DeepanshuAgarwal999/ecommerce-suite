'use client';

import { useEffect } from 'react';
import { registerAuthBridge } from '@/lib/api/auth-bridge';
import { refreshSession } from '@/lib/api/client';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../store/auth-store';
import { isStaff } from '../types';

/**
 * Mounted once at the root. Wires the auth store into the fetch client's
 * bridge, then attempts to restore a session from the httpOnly refresh
 * cookie — the same thing a page reload needs.
 *
 * A restored session for a non-staff account (a vendor or customer token is
 * technically valid) is treated as "not signed in" here rather than
 * surfaced as an error: the login page's own role check explains *why* a
 * real sign-in attempt is rejected, this boot-time path should just fail
 * quietly back to the login screen.
 */
export function SessionRestorer() {
  useEffect(() => {
    registerAuthBridge({
      getAccessToken: () => useAuthStore.getState().accessToken,
      onRefreshed: (tokens) =>
        useAuthStore.getState().setSession(tokens.accessToken, tokens.expiresIn),
      onRefreshFailed: () => useAuthStore.getState().clearSession(),
    });

    let cancelled = false;

    (async () => {
      // `onRefreshed`/`onRefreshFailed` above already settle isRestoring either way.
      const restored = await refreshSession();
      if (cancelled || !restored) return;

      try {
        const user = await authApi.me();
        if (cancelled) return;

        if (!isStaff(user)) {
          useAuthStore.getState().clearSession();
          return;
        }
        useAuthStore.getState().setUser(user);
      } catch {
        if (!cancelled) useAuthStore.getState().clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
