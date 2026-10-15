'use client';

import { Toaster } from '@/components/ui/sonner';
import { SessionRestorer } from '@/features/auth/components/session-restorer';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Single mount point for every client-side provider the app needs. Unlike
 * the storefront there is no LoginDialog here — this console gates on a
 * dedicated /login route, since every visit to a staff tool starts
 * unauthenticated and a full page is the conventional B2B pattern.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <SessionRestorer />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </QueryProvider>
    </ThemeProvider>
  );
}
