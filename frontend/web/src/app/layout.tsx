import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Lora, Manrope } from 'next/font/google';
import { env } from '@/config/env';
import { siteConfig } from '@/config/site';
import { ArchClipDefs, getActiveTheme, OccasionStyle, presetMeta } from '@/features/theme';
import { cn } from '@/lib/utils';
import { AppProviders } from '@/providers';
import './global.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  axes: ['opsz'],
});

/** Serif italic for festive section headings ("Diwali Hosting Needs"). */
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
  style: ['italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the fixed bottom nav extend under the iOS home indicator.
  viewportFit: 'cover',
};

/**
 * The live occasion theme (Diwali, Holi, ...) is applied here, on <html>, rather
 * than in the shop layout so portalled UI - dialogs, sheets, toasts - picks up
 * the festive palette too. See features/theme and the [data-occasion] blocks
 * in global.css.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getActiveTheme();

  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      data-occasion={theme ? presetMeta[theme.preset]?.key : undefined}
      className={cn(manrope.variable, bricolage.variable, lora.variable)}
    >
      <head>
        <OccasionStyle theme={theme} />
      </head>
      <body className="min-h-dvh">
        <ArchClipDefs />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
