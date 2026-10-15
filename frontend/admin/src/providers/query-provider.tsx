'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dashboard numbers a minute stale are fine; a vendor queue or stock
        // table is refetched on its own cadence by the page that owns it.
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
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
