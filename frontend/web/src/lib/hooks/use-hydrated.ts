'use client';

import { useEffect, useState } from 'react';

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Anything driven by persisted localStorage state (cart count, saved address)
 * must gate on this, or the server HTML and the first client render disagree
 * and React discards the tree with a hydration error.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
