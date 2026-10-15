'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Meesho-style rotating hint: "Search for" stays put while the product word
 * rolls up and is replaced every couple of seconds. Overlaid on the input
 * (pointer-events-none) because a native `placeholder` can't animate.
 *
 * Starts on a fixed word so server and client render the same first frame;
 * rotation begins after mount. `paused` freezes it while the shopper types.
 * Respects reduced motion (the word still changes, without the roll).
 */
export function AnimatedPlaceholder({
  hints,
  paused,
  className,
}: {
  hints: readonly string[];
  paused?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || hints.length < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % hints.length), 2600);
    return () => clearInterval(timer);
  }, [paused, hints.length]);

  return (
    <span
      aria-hidden
      className={cn(
        'text-muted-foreground pointer-events-none flex min-w-0 items-center gap-[0.3em] overflow-hidden text-[15px] whitespace-nowrap',
        className,
      )}
    >
      Search for
      <span className="relative inline-flex h-[1.4em] min-w-0 items-center overflow-hidden">
        {/* Re-keyed per word so the enter animation replays on every change. */}
        <span
          key={index}
          className="animate-in slide-in-from-bottom-[110%] fade-in truncate duration-500 ease-out motion-reduce:animate-none"
        >
          &quot;{hints[index]}&quot;
        </span>
      </span>
    </span>
  );
}
