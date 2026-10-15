import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { GarlandMotif } from '../presets';

/**
 * The toran strip hung under the site header while an occasion theme is live -
 * the single biggest "the site dressed up for Diwali" cue. Pure inline SVG on a
 * repeating <pattern>, so it costs no image request and recolours from the
 * theme tokens (`--festive-gold`, `--primary`, ...) like everything else.
 */
const W = 72;
const H = 40;

/** The drooping string every motif hangs from: one swag per pattern tile. */
function Swag() {
  return (
    <path
      d={`M0 3 Q${W / 2} 16 ${W} 3`}
      fill="none"
      strokeWidth={1.5}
      style={{ stroke: 'var(--festive-gold)' }}
    />
  );
}

/** A short drop of n flowers from (x, y). */
function MarigoldStrand({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, index) => (
        <circle
          key={index}
          cx={x}
          cy={y + index * 7}
          r={3.6}
          style={{ fill: index % 2 === 0 ? 'oklch(0.74 0.17 60)' : 'oklch(0.82 0.16 85)' }}
        />
      ))}
      <path
        d={`M${x} ${y + n * 7 - 2} l-3 5 h6 z`}
        style={{ fill: 'oklch(0.55 0.13 145)' }}
      />
    </g>
  );
}

function Diya({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y - 8} x2={x} y2={y} strokeWidth={1} style={{ stroke: 'var(--festive-gold)' }} />
      <path d={`M${x - 7} ${y + 4} Q${x} ${y + 12} ${x + 7} ${y + 4} Z`} style={{ fill: 'var(--festive-gold)' }} />
      <path
        d={`M${x} ${y - 5} q3 4.5 0 8 q-3 -3.5 0 -8 z`}
        transform={`translate(0 ${2})`}
        style={{ fill: 'oklch(0.78 0.18 60)' }}
      />
    </g>
  );
}

const motifs: Record<Exclude<GarlandMotif, 'none'>, ReactNode> = {
  marigold: (
    <>
      <Swag />
      <MarigoldStrand x={6} y={6} n={3} />
      <MarigoldStrand x={W - 6} y={6} n={3} />
      <Diya x={W / 2} y={18} />
    </>
  ),
  gulal: (
    <>
      {[
        [8, 10, 5, 'oklch(0.66 0.25 350)'],
        [24, 26, 4, 'oklch(0.85 0.17 95)'],
        [40, 12, 6, 'oklch(0.62 0.19 150)'],
        [56, 28, 4.5, 'oklch(0.6 0.2 260)'],
        [66, 8, 3.5, 'oklch(0.7 0.2 45)'],
        [32, 34, 2.5, 'oklch(0.66 0.25 350)'],
      ].map(([cx, cy, r, color]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={0.85} style={{ fill: String(color) }} />
      ))}
    </>
  ),
  bunting: (
    <>
      <path d={`M0 3 Q${W / 2} 10 ${W} 3`} fill="none" strokeWidth={1} style={{ stroke: 'oklch(0.45 0.02 260)' }} />
      <path d="M4 4 L16 4 L10 18 Z" style={{ fill: 'oklch(0.72 0.18 55)' }} />
      <path d="M30 6.5 L42 6.5 L36 20.5 Z" style={{ fill: 'oklch(0.98 0 0)', stroke: 'oklch(0.85 0 0)' }} strokeWidth={0.6} />
      <path d="M56 4 L68 4 L62 18 Z" style={{ fill: 'oklch(0.52 0.14 150)' }} />
    </>
  ),
  lantern: (
    <>
      <Swag />
      <line x1={W / 2} y1={9.5} x2={W / 2} y2={15} strokeWidth={1} style={{ stroke: 'var(--festive-gold)' }} />
      <rect x={W / 2 - 5} y={15} width={10} height={14} rx={3} style={{ fill: 'var(--festive-gold)' }} />
      <rect x={W / 2 - 2.5} y={18} width={5} height={8} rx={1.5} style={{ fill: 'oklch(0.9 0.12 90)' }} />
      <path d="M10 14 a6 6 0 1 0 6 -6 a4.5 4.5 0 1 1 -6 6 z" style={{ fill: 'var(--festive-gold)' }} />
      <path
        d="M60 12 l1.5 3 3.3 .4 -2.4 2.3 .6 3.3 -3 -1.6 -3 1.6 .6 -3.3 -2.4 -2.3 3.3 -.4 z"
        style={{ fill: 'var(--festive-gold)' }}
      />
    </>
  ),
  bauble: (
    <>
      <Swag />
      {[
        [14, 14, 'oklch(0.55 0.2 25)'],
        [W / 2, 22, 'var(--festive-gold)'],
        [58, 14, 'oklch(0.5 0.13 150)'],
      ].map(([cx, cy, color]) => (
        <g key={String(cx)}>
          <line x1={cx} y1={Number(cy) - 8} x2={cx} y2={Number(cy) - 5} strokeWidth={1} style={{ stroke: 'var(--festive-gold)' }} />
          <circle cx={cx} cy={cy} r={5} style={{ fill: String(color) }} />
          <circle cx={Number(cx) - 1.6} cy={Number(cy) - 1.6} r={1.3} fill="white" opacity={0.6} />
        </g>
      ))}
    </>
  ),
  rakhi: (
    <>
      <Swag />
      <circle cx={W / 2} cy={20} r={7} style={{ fill: 'var(--festive-gold)' }} />
      <circle cx={W / 2} cy={20} r={3.5} style={{ fill: 'var(--highlight)' }} />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx={W / 2}
          cy={11.5}
          rx={2}
          ry={3}
          transform={`rotate(${angle} ${W / 2} 20)`}
          style={{ fill: 'var(--primary)' }}
        />
      ))}
      <MarigoldStrand x={6} y={6} n={2} />
      <MarigoldStrand x={W - 6} y={6} n={2} />
    </>
  ),
};

export function FestiveGarland({ motif, className }: { motif: GarlandMotif; className?: string }) {
  if (motif === 'none') return null;
  const id = `garland-${motif}`;

  return (
    <div aria-hidden className={cn('pointer-events-none h-10 w-full overflow-hidden', className)}>
      <svg width="100%" height={H} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={id} width={W} height={H} patternUnits="userSpaceOnUse">
            {motifs[motif]}
          </pattern>
        </defs>
        <rect width="100%" height={H} fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

/**
 * The jharokha (Mughal window) outline Vaaree frames its festive tiles in,
 * defined once per page and referenced by `clip-path: url(#arch-clip)`.
 * objectBoundingBox units make it scale to any tile size.
 */
export function ArchClipDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <clipPath id="arch-clip" clipPathUnits="objectBoundingBox">
          <path d="M0 1 L0 0.27 C0 0.16 0.1 0.12 0.24 0.11 C0.37 0.1 0.45 0.07 0.5 0 C0.55 0.07 0.63 0.1 0.76 0.11 C0.9 0.12 1 0.16 1 0.27 L1 1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
