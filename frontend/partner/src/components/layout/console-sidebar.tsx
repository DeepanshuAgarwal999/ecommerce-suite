'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { consoleNav } from '@/config/nav';
import { siteConfig } from '@/config/site';

export function ConsoleSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-topbar justify-center px-3">
        <Link href="/" className="flex items-center gap-2 px-1">
          <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-sm font-extrabold">
            N
          </span>
          <span className="font-heading group-data-[collapsible=icon]:hidden truncate text-base font-extrabold">
            {siteConfig.name}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {consoleNav.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="text-muted-foreground px-2 text-xs">
          Need help?{' '}
          <a href={`mailto:${siteConfig.support.email}`} className="text-primary hover:underline">
            Contact support
          </a>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
