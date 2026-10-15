'use client';

import { Toaster } from '@/components/ui/sonner';
import { LoginDialog } from '@/features/auth/components/login-dialog';
import { SessionRestorer } from '@/features/auth/components/session-restorer';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/** Single mount point for every client-side provider the app needs. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryProvider>
        <SessionRestorer />
        {children}
        <LoginDialog />
        <Toaster position="top-center" richColors closeButton />
      </QueryProvider>
    </ThemeProvider>
  );
}
