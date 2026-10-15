'use client';

import { LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLogout, useSession } from '@/features/auth/hooks/use-session';
import { useVendor } from '@/features/vendor/hooks/use-vendor';
import { formatMobile } from '@/lib/validations/auth';
import { initials } from '@/lib/utils/format';

export function ConsoleTopbar() {
  const session = useSession();
  const vendor = useVendor();
  const logout = useLogout();

  const businessName = vendor.vendor?.businessName ?? 'Your store';
  const mobile = session.user ? formatMobile(session.user.mobile, session.user.countryCode) : '';

  return (
    <header className="bg-card sticky top-0 z-30 flex h-topbar items-center gap-3 border-b px-4">
      <SidebarTrigger />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{businessName}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full">
          <Avatar className="size-9">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-extrabold">
              {initials(businessName) || <User className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-bold">{businessName}</span>
              <span className="text-muted-foreground text-xs font-normal">{mobile}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout.mutate()} variant="destructive">
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
