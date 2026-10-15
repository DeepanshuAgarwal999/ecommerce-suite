import { ConsoleSidebar } from '@/components/layout/console-sidebar';
import { ConsoleTopbar } from '@/components/layout/console-topbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { VendorGate } from '@/features/vendor/components/vendor-gate';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorGate>
      <SidebarProvider>
        <ConsoleSidebar />
        <SidebarInset>
          <ConsoleTopbar />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </VendorGate>
  );
}
