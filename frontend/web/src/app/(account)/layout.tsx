import {
  AnnouncementBar,
  BottomNav,
  SiteFooter,
  SiteHeader,
} from '@/components/layout';
import { AccountNav } from '@/features/auth/components/account-nav';
import { SupportWidget } from '@/features/support/components/support-widget';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main className="container flex-1 py-6 pb-bottom-nav md:grid md:grid-cols-[220px_1fr] md:gap-10 md:py-10 md:pb-10">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </main>
      <SiteFooter />
      <SupportWidget />
      <BottomNav />
    </div>
  );
}
