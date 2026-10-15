import { cn } from '@/lib/utils';

/**
 * A lit clay diya, drawn in a 60x48 box with the bowl's rim at y=26. A <g>, so
 * it can sit inside any SVG (garland pattern, banner strip) - translate/scale
 * it from the outside. Gradients come from FestiveSvgDefs; `animated` adds the
 * flame flicker and halo pulse (both off under prefers-reduced-motion).
 */
export function Diya({ animated = false, transform }: { animated?: boolean; transform?: string }) {
  return (
    <g transform={transform}>
      <circle cx={30} cy={13} r={17} fill="url(#dw-glow)" className={cn(animated && 'diya-glow')} />
      <g className={cn(animated && 'diya-flame')}>
        <path d="M30 1.5 C34.5 8.5 36.5 14 30 22.5 C23.5 14 25.5 8.5 30 1.5 Z" fill="url(#dw-flame)" />
        <path d="M30 11 C32 14 32.4 17 30 21 C27.6 17 28 14 30 11 Z" fill="#fffdf2" opacity={0.9} />
      </g>
      <line x1={30} y1={21} x2={30} y2={25.5} stroke="#3a1a08" strokeWidth={1.4} strokeLinecap="round" />
      {/* Bowl with a pointed spout on the right, as on a real diya. */}
      <path d="M5 26 Q30 31 55 26 Q57 25 59 24 Q55 29 52 31 Q46 45 30 46 Q12 45 6.5 31 Q5 28 5 26 Z" fill="url(#dw-clay)" />
      <ellipse cx={30} cy={26} rx={25} ry={4.2} fill="url(#dw-gold)" />
      <ellipse cx={30} cy={26} rx={20} ry={2.6} fill="#3d1707" />
      {/* Painted dot band on the bowl. */}
      {[14, 22, 30, 38, 46].map((x) => (
        <circle key={x} cx={x} cy={x === 30 ? 37.5 : 36.5} r={1.5} fill="#ffd36b" opacity={0.85} />
      ))}
      <path d="M11 33 Q30 39 49 33" fill="none" stroke="#ffd36b" strokeWidth={0.8} opacity={0.6} />
    </g>
  );
}

/**
 * A diya hanging from a gold bead chain - `drop` is the chain length in px.
 * The whole piece sways gently from its top when `animated`.
 */
export function HangingDiya({
  drop,
  scale = 1,
  delay = 0,
  className,
}: {
  drop: number;
  scale?: number;
  /** Seconds - staggers sway/flicker so a row of diyas never moves in lockstep. */
  delay?: number;
  className?: string;
}) {
  const height = drop + 48;
  const beads = Math.floor(drop / 7);

  return (
    <svg
      aria-hidden
      width={60 * scale}
      height={height * scale}
      viewBox={`0 0 60 ${height}`}
      className={cn('diya-swing overflow-visible', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      {Array.from({ length: beads }, (_, index) => (
        <circle key={index} cx={30} cy={index * 7 + 3} r={index % 3 === 2 ? 2.2 : 1.5} fill="url(#dw-gold)" />
      ))}
      {/* Three cords from the chain to the rim. */}
      <path
        d={`M30 ${drop} L7 ${drop + 25} M30 ${drop} L53 ${drop + 25} M30 ${drop} L30 ${drop + 3}`}
        stroke="#e3b95a"
        strokeWidth={0.7}
        opacity={0.8}
        fill="none"
      />
      <Diya animated transform={`translate(0 ${drop - 1})`} />
    </svg>
  );
}
