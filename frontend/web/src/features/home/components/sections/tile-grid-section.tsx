import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CmsHomeSection, CmsSectionTile } from '../../cms-types';
import { SectionShell } from './section-shell';

type TileShape = 'square' | 'circle' | 'arch';

/**
 * Image tiles linking anywhere - "Shop by occasion", "Top categories", or
 * Vaaree's festive arches. Shape comes from `config.tileShape`; `arch` frames
 * each tile in a gold-trimmed jharokha over the festive surface (the clip path
 * is defined once in the root layout - see ArchClipDefs).
 */
export function TileGridSection({ section }: { section: CmsHomeSection }) {
  if (section.tiles.length === 0) return null;
  const shape: TileShape = section.config?.tileShape ?? 'square';

  return (
    <SectionShell
      section={section}
      viewAll={section.config?.viewAllUrl ? { href: section.config.viewAllUrl, label: 'View all' } : undefined}
    >
      <ul
        className={cn(
          'rail -mx-4 px-4 md:mx-0 md:grid md:gap-4 md:px-0',
          shape === 'arch' ? 'md:grid-cols-8' : 'md:grid-cols-6',
        )}
      >
        {section.tiles.map((tile) => (
          <li key={tile.id} className={cn('shrink-0 md:w-auto', shape === 'arch' ? 'w-[124px]' : 'w-[104px]')}>
            <Tile tile={tile} shape={shape} />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function Tile({ tile, shape }: { tile: CmsSectionTile; shape: TileShape }) {
  const image = (
    <Image
      src={tile.imageUrl}
      alt={tile.imageAlt}
      fill
      sizes="(min-width: 768px) 180px, 124px"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );

  return (
    <Link href={tile.linkUrl} className="group flex flex-col items-center gap-2">
      {shape === 'arch' ? (
        // Gold outer arch with the inner arch inset by 3px reads as a gilt frame.
        <span className="clip-arch bg-festive-gold block aspect-[4/5] w-full p-[3px] transition-transform group-hover:-translate-y-0.5">
          <span className="clip-arch festive-surface relative block size-full overflow-hidden">{image}</span>
        </span>
      ) : (
        <span
          className={cn(
            'bg-secondary relative aspect-square w-full overflow-hidden transition-shadow group-hover:shadow-[0_8px_24px_oklch(0.42_0.21_330/0.12)]',
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
          )}
        >
          {image}
        </span>
      )}
      <span
        className={cn(
          'text-center font-bold',
          shape === 'arch' ? 'text-[13px] leading-tight md:text-base' : 'text-xs md:text-sm',
        )}
      >
        {tile.title}
      </span>
    </Link>
  );
}
