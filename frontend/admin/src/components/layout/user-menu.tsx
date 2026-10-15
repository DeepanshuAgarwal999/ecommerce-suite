'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi } from '@/features/auth/api/auth-api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { formatMobile } from '@/lib/validations/auth';

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  if (!user) return null;

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : user.mobile.slice(-2);
  const primaryRole = user.roles[0] ?? 'STAFF';

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Clearing the local session still ends access even if the network call fails.
    } finally {
      clearSession();
      toast.success('Signed out');
      router.replace('/login');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-semibold">{formatMobile(user.mobile, user.countryCode)}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.email ?? primaryRole.replace('_', ' ')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="size-4" aria-hidden />
          {user.roles.join(', ')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
