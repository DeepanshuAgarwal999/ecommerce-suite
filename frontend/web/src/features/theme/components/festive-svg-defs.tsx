/**
 * Shared SVG definitions for occasion artwork, rendered once per page by the
 * root layout and referenced from any other inline SVG by id (`url(#dw-flame)`,
 * `clip-path: url(#arch-clip)`). One copy keeps ids unique and spares every
 * diya in a garland or banner from shipping its own gradients.
 */
export function FestiveSvgDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        {/* The jharokha (Mughal window) outline Vaaree frames its festive tiles
            in. objectBoundingBox units make it scale to any tile size. */}
        <clipPath id="arch-clip" clipPathUnits="objectBoundingBox">
          <path d="M0 1 L0 0.27 C0 0.16 0.1 0.12 0.24 0.11 C0.37 0.1 0.45 0.07 0.5 0 C0.55 0.07 0.63 0.1 0.76 0.11 C0.9 0.12 1 0.16 1 0.27 L1 1 Z" />
        </clipPath>

        {/* Diya: white-hot core -> yellow -> orange flame tip. */}
        <linearGradient id="dw-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fff8e1" />
          <stop offset="35%" stopColor="#ffe082" />
          <stop offset="75%" stopColor="#ffb300" />
          <stop offset="100%" stopColor="#ff6f00" />
        </linearGradient>
        <radialGradient id="dw-glow">
          <stop offset="0%" stopColor="#ffe9a8" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#ffc94d" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ff9800" stopOpacity="0" />
        </radialGradient>
        {/* Terracotta bowl, lit from the flame above. */}
        <linearGradient id="dw-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9772b" />
          <stop offset="55%" stopColor="#a4471a" />
          <stop offset="100%" stopColor="#5e230b" />
        </linearGradient>
        <linearGradient id="dw-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b8862b" />
          <stop offset="45%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#b8862b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
