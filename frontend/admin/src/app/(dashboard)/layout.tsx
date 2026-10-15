'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useRequireStaff } from '@/features/auth/hooks/use-require-staff';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isReady, isRestoring } = useRequireStaff();

  if (isRestoring) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">Loading console…</p>
        </div>
      </div>
    );
  }

  // Not ready and not restoring means the redirect to /login is already in
  // flight (useRequireStaff triggers it) — render nothing in the meantime
  // rather than flash the shell for an unauthenticated visitor.
  if (!isReady) return null;

  return <AppShell>{children}</AppShell>;
}
