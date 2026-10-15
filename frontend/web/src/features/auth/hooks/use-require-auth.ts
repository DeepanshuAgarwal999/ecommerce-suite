'use client';

import { useCallback } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useIsSignedIn } from './use-session';

/**
 * Gates an action behind sign-in. Returns a wrapper that runs the action when
 * the shopper is signed in and otherwise opens the login dialog in place —
 * wishlist, checkout and saved addresses all use it instead of redirecting.
 *
 *   const requireAuth = useRequireAuth();
 *   <button onClick={requireAuth(() => save(product))}>Save</button>
 */
export function useRequireAuth() {
  const isSignedIn = useIsSignedIn();
  const openLogin = useUiStore((state) => state.openLogin);

  return useCallback(
    (action: () => void) => () => {
      if (isSignedIn) {
        action();
        return;
      }
      openLogin();
    },
    [isSignedIn, openLogin],
  );
}

/** Imperative form, for places that are not click handlers. */
export function useOpenLogin() {
  return useUiStore((state) => state.openLogin);
}
