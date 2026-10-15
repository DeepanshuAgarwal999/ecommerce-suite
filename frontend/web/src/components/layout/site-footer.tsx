import { Apple, Play } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { footerNav } from '@/config/nav';
import { siteConfig } from '@/config/site';
import { footerApi } from '@/features/footer/api/footer-api';
import type { FooterColumn, FooterData } from '@/features/footer/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from './logo';
import { socialLabel, SocialIcon } from './social-icon';

/** Static fallback so the footer is never blank while the CMS is empty or the
 *  service is briefly unreachable - same philosophy as HeroCarousel/ProductRail. */
const fallbackColumns: FooterColumn[] = footerNav.map((group) => ({
  id: group.title,
  title: group.title,
  links: group.links.map((link) => ({ id: link.href, ...link })),
}));

async function getFooterData(): Promise<FooterData> {
  try {
    const data = await footerApi.get({ next: { revalidate: 300 } });
    return data.columns.length > 0 ? data : { columns: fallbackColumns, settings: data.settings };
  } catch {
    return { columns: fallbackColumns, settings: null };
  }
}

export function SiteFooter() {
  return (
    <Suspense fallback={<FooterSkeleton />}>
      <SiteFooterContent />
    </Suspense>
  );
}

async function SiteFooterContent() {
  const { columns, settings } = await getFooterData();
  const social = settings?.socialLinks ?? [];

  return (
    <footer className="bg-card mt-16 border-t pb-bottom-nav md:pb-0">
      <div className="container py-12">
        <div className="mb-10 flex flex-col gap-3">
          <Logo size={24} />
          <p className="text-muted-foreground max-w-xs text-sm">{siteConfig.tagline}.</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {columns.map((column) => (
            <div key={column.id} className="min-w-0">
              <h3 className="mb-3 text-xs font-extrabold tracking-[0.08em] uppercase">
                {column.title}
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link href={link.href} className="text-foreground/80 hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t">
        <div className="container flex flex-col gap-6 py-6 md:flex-row md:items-center md:justify-between">
          {social.length > 0 && (
            <div className="flex items-center gap-3">
              {social.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabel(link.platform)}
                  className="text-muted-foreground hover:text-primary hover:border-primary grid size-8 place-items-center rounded-full border transition-colors"
                >
                  <SocialIcon platform={link.platform} className="size-4" />
                </a>
              ))}
            </div>
          )}

          {(settings?.appStoreUrl || settings?.playStoreUrl) && (
            <div className="flex items-center gap-2">
              {settings.appStoreUrl && (
                <a
                  href={settings.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-input hover:border-primary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Apple className="size-4" aria-hidden />
                  App Store
                </a>
              )}
              {settings.playStoreUrl && (
                <a
                  href={settings.playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-input hover:border-primary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Play className="size-4" aria-hidden />
                  Google Play
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t">
        <div className="container text-muted-foreground flex flex-col gap-2 py-5 text-xs md:flex-row md:items-center md:justify-between">
          <span>{settings?.copyrightText || `© ${new Date().getFullYear()} ${siteConfig.name}. All rights reserved.`}</span>
          <span>Prices in INR, inclusive of all taxes.</span>
        </div>
      </div>
    </footer>
  );
}

/** Loading fallback, dimensioned loosely to match the real footer so content
 *  never shifts much when it swaps in. */
function FooterSkeleton() {
  return (
    <div className="bg-card mt-16 border-t">
      <div className="container py-12">
        <Skeleton className="mb-10 h-6 w-32" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <Skeleton className="mb-1 h-3.5 w-20" />
              {Array.from({ length: 5 }, (_, row) => (
                <Skeleton key={row} className="h-3 w-24" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
