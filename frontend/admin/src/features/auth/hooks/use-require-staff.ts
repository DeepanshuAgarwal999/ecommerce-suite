'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';

/**
 * Gates the dashboard shell. `SessionRestorer` has already discarded any
 * restored session that isn't staff, so by the time `isRestoring` flips to
 * false, "signed in" and "authorised" are the same question here.
 */
export function useRequireStaff() {
  const router = useRouter();
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const isSignedIn = useAuthStore((state) => Boolean(state.accessToken));

  useEffect(() => {
    if (!isRestoring && !isSignedIn) router.replace('/login');
  }, [isRestoring, isSignedIn, router]);

  return { isReady: !isRestoring && isSignedIn, isRestoring };
}
