'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Logo } from './logo';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Topbar() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:pl-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-sidebar bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-topbar flex-row items-center px-4 py-0">
            <SheetTitle asChild>
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <div className="py-2">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-4" aria-hidden />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
