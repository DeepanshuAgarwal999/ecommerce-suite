import {
  AnnouncementBar,
  BottomNav,
  CategoryNav,
  SiteFooter,
  SiteHeader,
} from '@/components/layout';
import { FloatingCartBar } from '@/features/cart/components/floating-cart-bar';
import { CategoryChips } from '@/features/home/components/category-chips';
import { SupportWidget } from '@/features/support/components/support-widget';
import { FestiveGarland, getActiveTheme, presetMeta } from '@/features/theme';

/** Storefront chrome: announcement + header + category nav on top, footer and
 *  phone bottom nav below. Auth and account routes use their own layouts.
 *  While an occasion theme is live a garland hangs under the nav. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const theme = await getActiveTheme();

  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <CategoryNav />
      <CategoryChips />
      {theme && <FestiveGarland motif={presetMeta[theme.preset]?.motif ?? 'none'} className="relative z-10 -mb-6 md:-mb-4" />}
      <main className="flex-1 pb-bottom-nav md:pb-0">{children}</main>
      <SiteFooter />
      <FloatingCartBar />
      <SupportWidget />
      <BottomNav />
    </div>
  );
}
