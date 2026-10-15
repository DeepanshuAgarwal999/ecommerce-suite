import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CmsHomeSection, CmsSectionTile } from '../../cms-types';

/**
 * One large promo card beside two stacked ones ("Lamps & Lighting - Upto 75%
 * off" | "Showpieces & Vases" / "Decorative Urlis"). Each card is a tile: title,
 * subtitle as the offer line, ctaLabel on the button. A 4th+ tile is ignored;
 * one or two tiles still lay out sensibly. No section heading - the cards are
 * the heading, as on Vaaree.
 */
export function SplitBannersSection({ section }: { section: CmsHomeSection }) {
  const [hero, ...rest] = section.tiles.slice(0, 3);
  if (!hero) return null;

  return (
    <section aria-label={section.title} className="container pt-8 md:pt-14">
      <div className={cn('grid gap-3 md:gap-5', rest.length > 0 && 'md:grid-cols-5 md:grid-rows-2')}>
        <PromoCard tile={hero} large className={cn(rest.length > 0 && 'md:col-span-3 md:row-span-2')} />
        {rest.map((tile) => (
          <PromoCard key={tile.id} tile={tile} className="md:col-span-2" />
        ))}
      </div>
    </section>
  );
}

function PromoCard({ tile, large, className }: { tile: CmsSectionTile; large?: boolean; className?: string }) {
  return (
    <Link
      href={tile.linkUrl}
      className={cn(
        'group relative block overflow-hidden rounded-2xl',
        large ? 'aspect-[4/3] md:aspect-auto md:min-h-[440px]' : 'aspect-[16/9] md:aspect-auto md:min-h-[210px]',
        className,
      )}
    >
      <Image
        src={tile.imageUrl}
        alt={tile.imageAlt}
        fill
        sizes={large ? '(min-width: 768px) 60vw, 100vw' : '(min-width: 768px) 40vw, 100vw'}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div aria-hidden className="from-brand-dark/80 via-brand-dark/35 absolute inset-0 bg-gradient-to-r to-transparent" />
      <div className={cn('relative flex h-full flex-col items-start text-white', large ? 'gap-3 p-6 md:p-10' : 'gap-2 p-5 md:p-7')}>
        <h3
          className={cn(
            'font-display max-w-[80%] leading-[1.05] font-medium italic tracking-normal',
            large ? 'text-[34px] md:text-[64px]' : 'text-[26px] md:text-[34px]',
          )}
        >
          {tile.title}
        </h3>
        {tile.subtitle && (
          <p className={cn('font-bold', large ? 'text-xl md:text-4xl' : 'text-base md:text-2xl')}>{tile.subtitle}</p>
        )}
        <span
          className={cn(
            'mt-auto inline-flex items-center rounded-lg bg-black/55 font-bold backdrop-blur-sm transition-colors group-hover:bg-black/75',
            large ? 'h-11 px-6 text-base md:h-12 md:text-lg' : 'h-9 px-4 text-sm',
          )}
        >
          {tile.ctaLabel || 'Shop now'}
        </span>
      </div>
    </Link>
  );
}
