const STORAGE_KEY = 'visitor-id';
let cached: string | null = null;

/**
 * A random, stable id for this browser - lets the recommender learn from what an
 * anonymous shopper browses and merge it into their account when they sign in
 * (the gateway sends both ids on the first signed-in request). It identifies a
 * device, not a person, and holds nothing else. Null on the server.
 */
export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  if (cached) return cached;
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    cached = id;
  } catch {
    // Storage blocked (private mode): a per-tab id still links one session's views.
    cached = crypto.randomUUID();
  }
  return cached;
}
