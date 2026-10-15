import type { ThemeColors } from '../types';

const ARCH = 'polygon(0 100%, 0 26%, 12% 13%, 30% 10%, 44% 6%, 50% 0, 56% 6%, 70% 10%, 88% 13%, 100% 26%, 100% 100%)';

/**
 * A thumbnail of the storefront in this palette: announcement bar, garland
 * line, arch tiles on the festive surface, a button and a deal band. Pure
 * colour blocks - enough to judge contrast before going live.
 */
export function ThemePreview({ colors, announcement }: { colors: Required<ThemeColors>; announcement: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white text-[10px] shadow-sm">
      <div className="truncate px-2 py-1.5 font-semibold text-white" style={{ background: colors.brandDark }}>
        ✦ {announcement}
      </div>
      <div className="flex items-center justify-between border-b px-2 py-2">
        <span className="font-bold" style={{ color: colors.primary }}>
          nestora
        </span>
        <span className="h-2 w-16 rounded-full bg-neutral-200" />
      </div>
      <div className="flex justify-around px-1" aria-hidden>
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} className="flex flex-col items-center">
            <span className="h-1.5 w-px" style={{ background: colors.gold }} />
            <span className="size-2 rounded-full" style={{ background: index % 2 ? colors.gold : colors.highlight }} />
          </span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1.5 px-2 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="aspect-[4/5] p-[2px]" style={{ background: colors.gold, clipPath: ARCH }}>
            <span className="block size-full" style={{ background: colors.surface, clipPath: ARCH }} />
          </span>
        ))}
      </div>

      <div className="px-2 py-2">
        <span
          className="inline-flex rounded px-2 py-1 font-bold text-white"
          style={{ background: colors.primary }}
        >
          Add to cart
        </span>
      </div>

      <div className="px-2 py-2" style={{ background: colors.wash }}>
        <p className="mb-1 font-bold">Deal of the Day</p>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="h-8 rounded bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
