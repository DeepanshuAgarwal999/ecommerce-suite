import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api';

/**
 * Retry only what can succeed on a second try: network blips, 5xx and 429.
 * A 400/404 will fail the same way forever, so it surfaces immediately.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) return error.isRetryable && failureCount < 2;
  return failureCount < 3;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      // Refetch on foreground (below) rather than on every remount of a screen.
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

/** "Window focus" on a phone = the app returning to the foreground. */
export function bindQueryLifecycle(): () => void {
  const appState = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });

  // Pause queries while offline and resume (with refetch) when the network returns.
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return () => subscription.remove();
  });

  return () => appState.remove();
}
