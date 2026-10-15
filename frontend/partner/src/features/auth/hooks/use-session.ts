'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { queryKeys } from '@/lib/api';
import { authApi } from '../api/auth-api';
import { selectIsSignedIn, useAuthStore } from '../store/auth-store';

export function useIsSignedIn(): boolean {
  return useAuthStore(selectIsSignedIn);
}

/** True while the boot-time refresh is still deciding whether we are signed in. */
export function useIsRestoringSession(): boolean {
  return useAuthStore((state) => state.isRestoring);
}

/** The signed-in identity, refreshed from /auth/me once a token exists. */
export function useSession() {
  const signedIn = useIsSignedIn();
  const isRestoring = useIsRestoringSession();
  const cached = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: signedIn,
    initialData: cached ?? undefined,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return { ...query, user: query.data ?? cached, isSignedIn: signedIn, isRestoring };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearSession();
      queryClient.clear();
      router.push('/login');
    },
  });
}
