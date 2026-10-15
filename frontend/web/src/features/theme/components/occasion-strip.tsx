import { Dancing_Script } from 'next/font/google';
import { cn } from '@/lib/utils';
import { getActiveTheme } from '../api/theme-api';
import type { ThemePreset } from '../types';
import { HangingDiya } from './diya';

/** Loaded here rather than in the root layout so only pages that render the
 *  strip (the home page, while a theme with artwork is live) download it. */
const script = Dancing_Script({ subsets: ['latin'], weight: '700', display: 'swap' });

interface StripCopy {
  eyebrow: string;
  greeting: string;
  /** Kept different from the theme's announcement, which the bar above already shows. */
  line: string;
}

/** Presets with banner artwork. Others render no strip - the garland and
 *  palette still dress the site. */
const copy: Partial<Record<ThemePreset, StripCopy>> = {
  DIWALI: {
    eyebrow: 'Festival of Lights',
    greeting: 'Happy Diwali',
    line: 'Diyas, lights & décor that glow',
  },
};

/** Left-side diyas: x as % of the strip, chain length, size, stagger. Mirrored on the right. */
const diyas = [
  { left: '2%', drop: 46, scale: 1.05, delay: 0, desktopOnly: false },
  { left: '9%', drop: 18, scale: 0.8, delay: 0.7, desktopOnly: false },
  { left: '16%', drop: 64, scale: 0.95, delay: 1.3, desktopOnly: true },
  { left: '23%', drop: 30, scale: 0.7, delay: 0.4, desktopOnly: true },
];

const sparkles = [
  { x: '29%', y: '22%', size: 9, delay: 0 },
  { x: '34%', y: '70%', size: 6, delay: 1.1 },
  { x: '41%', y: '14%', size: 5, delay: 2 },
  { x: '58%', y: '18%', size: 7, delay: 0.6 },
  { x: '64%', y: '74%', size: 9, delay: 1.6 },
  { x: '71%', y: '26%', size: 5, delay: 0.3 },
  { x: '48%', y: '86%', size: 4, delay: 2.4 },
  { x: '12%', y: '84%', size: 5, delay: 1.9 },
  { x: '88%', y: '80%', size: 6, delay: 0.9 },
];

/** Rangoli/mandala line art: rings of petals, used very faintly behind the lamps. */
function Mandala({ className }: { className?: string }) {
  const petals = (count: number, rx: number, ry: number, offset: number) =>
    Array.from({ length: count }, (_, index) => (
      <ellipse
        key={`${count}-${index}`}
        cx={0}
        cy={-offset}
        rx={rx}
        ry={ry}
        transform={`rotate(${(360 / count) * index})`}
      />
    ));

  return (
    <svg aria-hidden viewBox="-100 -100 200 200" className={cn('pointer-events-none absolute', className)}>
      <g fill="none" stroke="var(--festive-gold)" strokeWidth={0.8}>
        <circle r={14} />
        <circle r={20} strokeDasharray="1.5 3" />
        {petals(12, 7, 16, 34)}
        <circle r={52} />
        {petals(24, 5, 13, 64)}
        <circle r={78} strokeDasharray="2 4" />
        {petals(36, 3, 8, 88)}
      </g>
    </svg>
  );
}

function Sparkle({ x, y, size, delay }: (typeof sparkles)[number]) {
  return (
    <svg
      aria-hidden
      viewBox="-5 -5 10 10"
      width={size}
      height={size}
      className="twinkle pointer-events-none absolute"
      style={{ left: x, top: y, animationDelay: `${delay}s` }}
    >
      <path d="M0 -5 L1.1 -1.1 L5 0 L1.1 1.1 L0 5 L-1.1 1.1 L-5 0 L-1.1 -1.1 Z" fill="#ffe7a3" />
    </svg>
  );
}

/**
 * The festive greeting banner at the top of the home page while an occasion
 * theme with artwork is live - "Happy Diwali" in gold script between rows of
 * hanging, flickering diyas over faint rangoli. Pure SVG + CSS, so it costs no
 * image request, and its background follows the theme's `--festive` colour,
 * so an admin palette override reaches it too.
 */
export async function OccasionStrip() {
  const theme = await getActiveTheme();
  const text = theme ? copy[theme.preset] : undefined;
  if (!theme || !text) return null;

  return (
    <section aria-label={text.greeting} className="container pt-3 md:pt-5">
      <div
        className="relative isolate h-[132px] overflow-hidden rounded-2xl md:h-[168px] md:rounded-[20px]"
        style={{
          background:
            'radial-gradient(ellipse 60% 120% at 50% 0%, color-mix(in oklch, var(--festive) 55%, #ff4d6d) 0%, transparent 70%),' +
            'linear-gradient(100deg, color-mix(in oklch, var(--festive) 70%, black) 0%, var(--festive) 45%, color-mix(in oklch, var(--festive) 65%, black) 100%)',
        }}
      >
        <Mandala className="-top-24 -left-24 size-72 opacity-[0.16] md:-top-32 md:-left-16 md:size-96" />
        <Mandala className="-right-24 -bottom-28 size-72 opacity-[0.16] md:-right-16 md:-bottom-36 md:size-96" />
        {/* Warm pool of light behind the greeting. */}
        <div
          aria-hidden
          className="absolute inset-x-[25%] inset-y-0 -z-10"
          style={{ background: 'radial-gradient(ellipse at center, rgb(255 200 90 / 0.22), transparent 70%)' }}
        />

        {diyas.map((diya, index) => (
          <div
            key={`l-${index}`}
            className={cn('absolute top-0 origin-top max-md:scale-[0.8]', diya.desktopOnly && 'hidden md:block')}
            style={{ left: diya.left }}
          >
            <HangingDiya drop={diya.drop} scale={diya.scale} delay={diya.delay} />
          </div>
        ))}
        {diyas.map((diya, index) => (
          <div
            key={`r-${index}`}
            className={cn('absolute top-0 origin-top max-md:scale-[0.8]', diya.desktopOnly && 'hidden md:block')}
            style={{ right: diya.left }}
          >
            <HangingDiya
              drop={diya.drop}
              scale={diya.scale}
              delay={diya.delay + 0.35}
            />
          </div>
        ))}

        {sparkles.map((sparkle) => (
          <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} />
        ))}

        <div className="relative flex h-full flex-col items-center justify-center px-20 text-center md:px-0">
          <p className="text-festive-gold flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase md:text-xs">
            <span aria-hidden>✦</span>
            {text.eyebrow}
            <span aria-hidden>✦</span>
          </p>
          <p
            className={cn(
              script.className,
              'bg-gradient-to-b from-[#fff6d6] via-[#f6d27a] to-[#c8902f] bg-clip-text pb-1 text-[38px] leading-tight text-transparent drop-shadow-[0_2px_10px_rgb(255_190_80/0.35)] md:text-[64px]',
            )}
          >
            {text.greeting}
          </p>
          <p className="line-clamp-1 max-w-[52ch] text-[11px] font-semibold tracking-wide text-white/85 md:text-sm">
            {text.line}
          </p>
        </div>
      </div>
    </section>
  );
}
