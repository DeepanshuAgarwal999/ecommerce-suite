'use client';

import { useEffect } from 'react';
import { firstInSession, track } from '../track';

/** Counts one view of this product per session, for admin Insights. Renders nothing. */
export function TrackProductView({ productId }: { productId: string }) {
  useEffect(() => {
    if (firstInSession(`view:${productId}`)) track('view', { productId });
  }, [productId]);
  return null;
}
