'use client';

import { LogOut, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMobile } from '@/lib/validations/auth';
import { useUiStore } from '@/store/ui-store';
import { useIsRestoringSession, useLogout, useSession } from '../hooks/use-session';

export function ProfileCard() {
  const session = useSession();
  const restoring = useIsRestoringSession();
  const logout = useLogout();
  const openLogin = useUiStore((state) => state.openLogin);

  if (restoring || (session.isSignedIn && session.isPending && !session.user)) {
    return (
      <div className="bg-card flex items-center gap-4 rounded-xl border p-5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    );
  }

  if (!session.user) {
    return (
      <EmptyState
        icon={UserRound}
        title="You are not signed in"
        description="Sign in with your mobile number to see your profile, orders and saved addresses."
        action={<Button onClick={openLogin}>Sign in</Button>}
      />
    );
  }

  const user = session.user;
  // Accounts start with only a mobile number — there is no name until they add one.
  const display = user.email ?? formatMobile(user.mobile, user.countryCode);

  return (
    <div className="bg-card flex flex-col gap-5 rounded-xl border p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-extrabold">
            <UserRound className="size-6" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-base font-extrabold">{display}</div>
          {user.email && (
            <div className="text-muted-foreground text-sm">
              {formatMobile(user.mobile, user.countryCode)}
            </div>
          )}
          {!user.email && (
            <div className="text-muted-foreground text-sm">
              Add an email to get order updates
            </div>
          )}
        </div>
      </div>

      <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
        <LogOut data-icon="inline-start" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
