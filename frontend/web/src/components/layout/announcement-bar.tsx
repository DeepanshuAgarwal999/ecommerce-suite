import Link from 'next/link';
import { Fragment } from 'react';
import { Sparkles } from 'lucide-react';
import { announcementLinks, announcementUsps } from '@/config/nav';
import { getActiveTheme } from '@/features/theme';

/**
 * Thin USP + utility-links strip above the header. Hidden on phones, where
 * the chips rail under the search box carries the same message - except while
 * an occasion theme with an announcement is live ("Diwali Sale is live"),
 * which is worth the extra line on every screen size.
 */
export async function AnnouncementBar() {
  const theme = await getActiveTheme();
  const announcement = theme?.announcement;

  return (
    <div
      className={
        announcement
          ? 'bg-brand-dark flex min-h-8 items-center text-[12.5px] font-semibold text-white/95 md:h-announcement md:text-[13px]'
          : 'bg-brand-dark hidden h-announcement items-center text-[13px] font-semibold text-white/95 md:flex'
      }
    >
      <div className="container flex items-center justify-between gap-4">
        {announcement ? (
          <p className="flex min-w-0 flex-1 items-center justify-center gap-2 py-1.5 text-center md:justify-start">
            <Sparkles className="text-festive-gold size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{announcement}</span>
          </p>
        ) : (
          <ul className="flex items-center gap-5">
            {announcementUsps.map((usp, index) => (
              <Fragment key={usp}>
                {index > 0 && (
                  <li aria-hidden className="text-white/40">
                    |
                  </li>
                )}
                <li>{usp}</li>
              </Fragment>
            ))}
          </ul>
        )}
        <ul className="hidden items-center gap-6 md:flex">
          {announcementLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
