import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="md:pl-sidebar">
        <Topbar />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
