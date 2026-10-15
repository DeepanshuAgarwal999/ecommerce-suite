'use client';

import { useEffect, useRef } from 'react';
import { trackRecommendation } from '@/features/analytics/track';

/**
 * Reports a recommendation rail as *seen* - at least half of it on screen for a full
 * second - once per mount. Rendered-but-below-the-fold doesn't count: impression
 * fatigue should only discount products the shopper actually had a chance to notice.
 */
export function useImpressions<T extends HTMLElement>(productIds: string[]) {
  const ref = useRef<T>(null);
  const key = productIds.join(',');

  useEffect(() => {
    const element = ref.current;
    if (!element || !key || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (sent) return;
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            sent = true;
            trackRecommendation('impression', { productIds: key.split(',') });
            observer.disconnect();
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  return ref;
}
