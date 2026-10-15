'use client';

import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { isSuperAdmin } from '@/features/auth/types';
import { ResetCacheButton } from '@/features/settings/components/reset-cache-button';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const canResetCache = isSuperAdmin(user);

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide controls. Handle with care." />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" aria-hidden />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset Redis cache</p>
              <p className="text-sm text-muted-foreground">
                Clears rate limits, in-flight OTP codes and every warm cache
                platform-wide. No business data is affected.
              </p>
            </div>
            {canResetCache ? (
              <ResetCacheButton />
            ) : (
              <p className="text-sm text-muted-foreground">Super admin only.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
