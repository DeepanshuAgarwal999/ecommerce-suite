import { useEffect, useState } from 'react';

/**
 * Progressive rendering for long screens: returns a stage counter that climbs
 * from 0 to `stages` one idle slot at a time after the first paint. Screens gate
 * below-the-fold blocks on it (`stage >= 2 && <Rail />`), so the first frame only
 * carries what's on screen and the rest streams in without a jank spike - the
 * native equivalent of the web's LazySection + Suspense split.
 */
export function useStagedMount(stages: number, interval = 60): number {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= stages) return;
    const schedule = globalThis.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 1));
    const cancel = globalThis.cancelIdleCallback ?? clearTimeout;
    let idle: ReturnType<typeof schedule> | undefined;
    const timer = setTimeout(() => {
      idle = schedule(() => setStage((value) => value + 1));
    }, interval);
    return () => {
      clearTimeout(timer);
      if (idle !== undefined) cancel(idle as never);
    };
  }, [stage, stages, interval]);

  return stage;
}
