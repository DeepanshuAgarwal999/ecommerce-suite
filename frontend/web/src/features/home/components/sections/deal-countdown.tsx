'use client';

import { useEffect, useState } from 'react';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Next midnight in India, as a UTC epoch - when the daily deal rolls over. */
function nextIstMidnight(now: number): number {
  return Math.floor((now + IST_OFFSET_MS) / DAY_MS + 1) * DAY_MS - IST_OFFSET_MS;
}

/**
 * "Ends in 22h : 50m : 34s". Counts to `endsAt` when the admin set one, else to
 * midnight IST (and rolls over to the next day's). Renders a placeholder until
 * mounted - server and client clocks never agree to the second.
 */
export function DealCountdown({ endsAt }: { endsAt?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const fixed = endsAt ? Date.parse(endsAt) : NaN;
    const tick = () => {
      const now = Date.now();
      const target = Number.isFinite(fixed) ? fixed : nextIstMidnight(now);
      setRemaining(Math.max(0, target - now));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const total = Math.floor((remaining ?? 0) / 1000);
  const parts: [number, string][] = [
    [Math.floor(total / 3600), 'h'],
    [Math.floor((total % 3600) / 60), 'm'],
    [total % 60, 's'],
  ];

  return (
    <p className="flex items-baseline gap-1.5 text-sm" aria-live="off">
      <span className="text-muted-foreground mr-1">Ends in</span>
      {parts.map(([value, unit], index) => (
        <span key={unit} className="flex items-baseline gap-1">
          {index > 0 && <span className="text-muted-foreground font-bold">:</span>}
          <span className="text-foreground min-w-[2ch] text-right text-base font-extrabold tabular-nums">
            {remaining === null ? '--' : String(value).padStart(2, '0')}
          </span>
          <span className="text-muted-foreground text-xs">{unit}</span>
        </span>
      ))}
    </p>
  );
}
