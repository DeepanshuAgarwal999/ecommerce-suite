'use client';

import { useEffect, useRef } from 'react';
import { registerAuthBridge } from '@/lib/api/auth-bridge';
import { refreshSession } from '@/lib/api/client';
import { useAuthStore } from '../store/auth-store';

/**
 * Connects the fetch client to the auth store and restores the session once
 * per page load by exchanging the httpOnly refresh cookie for a fresh access
 * token. Renders nothing.
 */
export function SessionRestorer() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    registerAuthBridge({
      getAccessToken: () => useAuthStore.getState().accessToken,
      onRefreshed: (tokens) =>
        useAuthStore.getState().setSession(tokens.accessToken, tokens.expiresIn),
      onRefreshFailed: () => useAuthStore.getState().clearSession(),
    });

    if (useAuthStore.getState().accessToken) {
      useAuthStore.getState().setRestoring(false);
      return;
    }

    void refreshSession();
  }, []);

  return null;
}
