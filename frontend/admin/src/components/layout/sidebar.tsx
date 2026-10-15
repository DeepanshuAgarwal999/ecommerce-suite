import { Logo } from './logo';
import { SidebarNav } from './sidebar-nav';

/** Fixed desktop sidebar. Hidden below md; the topbar's sheet covers mobile. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-topbar items-center px-4">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav />
      </div>
    </aside>
  );
}
