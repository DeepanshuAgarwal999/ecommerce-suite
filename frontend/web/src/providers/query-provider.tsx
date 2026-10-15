'use client';

import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A product feed that is a minute stale is fine; refetching on every
        // focus burns mobile data for no visible gain.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && !error.isRetryable) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // On the server every request needs its own client so users never share a
  // cache. In the browser we keep one across renders, but not across Suspense
  // boundaries recreating it.
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
