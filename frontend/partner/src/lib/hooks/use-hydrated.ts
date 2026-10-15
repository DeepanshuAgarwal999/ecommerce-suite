'use client';

import { useEffect, useState } from 'react';

/**
 * False during SSR and the first client render, true afterwards. Anything
 * driven by the in-memory auth store must gate on this so the server HTML and
 * the first client render agree.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
