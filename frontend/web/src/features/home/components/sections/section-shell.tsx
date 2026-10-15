import Link from 'next/link';
import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/common/section-header';
import { cn } from '@/lib/utils';
import type { CmsHomeSection } from '../../cms-types';

interface SectionShellProps {
  section: CmsHomeSection;
  children: ReactNode;
  /** Rendered beside (plain heading) or under (festive heading) the title - e.g. a countdown. */
  aside?: ReactNode;
  /** Override the section's configured tone (the deal band defaults to `wash`). */
  defaultTone?: 'plain' | 'wash' | 'festive';
  /** "View all" CTA under the content, centred. */
  viewAll?: { href: string; label: string };
}

/**
 * The frame every CMS section sits in: its background band (`config.tone`) and
 * its heading. Occasion sections - tied to a theme, or on the festive band - get
 * the centred serif-italic heading Vaaree uses ("Diwali Hosting Needs"); the
 * evergreen ones keep the compact left-aligned SectionHeader.
 */
export function SectionShell({ section, children, aside, defaultTone = 'plain', viewAll }: SectionShellProps) {
  const tone = section.config?.tone ?? defaultTone;
  const festiveHeading = Boolean(section.themeId) || tone === 'festive';
  const banded = tone !== 'plain';

  return (
    <section
      aria-label={section.title}
      className={cn(
        banded ? 'mt-8 py-8 md:mt-14 md:py-12' : 'pt-8 md:pt-14',
        tone === 'wash' && 'bg-festive-wash',
        tone === 'festive' && 'festive-surface text-festive-foreground',
      )}
    >
      <div className="container">
        {festiveHeading ? (
          <div className="mb-5 flex flex-col items-center gap-1.5 text-center md:mb-8">
            <h2
              className={cn(
                'font-display text-[26px] leading-tight font-medium italic tracking-normal md:text-[40px]',
                tone === 'festive' ? 'text-festive-gold' : 'text-brand-dark',
              )}
            >
              {section.title}
            </h2>
            {section.subtitle && (
              <p className={cn('text-sm', tone === 'festive' ? 'text-white/80' : 'text-muted-foreground')}>
                {section.subtitle}
              </p>
            )}
            {aside && <div className="mt-1">{aside}</div>}
          </div>
        ) : (
          <div className="flex items-end justify-between gap-3">
            <SectionHeader title={section.title} subtitle={section.subtitle ?? undefined} className="min-w-0" />
            {aside && <div className="mb-3 shrink-0">{aside}</div>}
          </div>
        )}

        {children}

        {viewAll && (
          <div className="mt-6 flex justify-center">
            <Link
              href={viewAll.href}
              className={cn(
                'inline-flex h-10 items-center rounded-lg border px-6 text-sm font-bold transition-colors',
                tone === 'festive'
                  ? 'border-festive-gold text-festive-gold hover:bg-festive-gold hover:text-festive'
                  : 'border-foreground/70 hover:bg-foreground hover:text-background',
              )}
            >
              {viewAll.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
