import { apiFetch, endpoints } from '@/lib/api';

/**
 * Fire-and-forget beacons to the gateway's analytics routes - same events the web
 * sends (features/analytics/track there). They carry the install id as the
 * visitor id and the bearer token when signed in (both added by apiFetch), so
 * the recommender can stitch pre-login browsing into the account. Failures are
 * swallowed: analytics must never surface an error or slow a screen.
 */
function post(path: string, body: Record<string, unknown>): void {
  apiFetch(path, { method: 'POST', body, timeoutMs: 8_000 }).catch(() => undefined);
}

export function track(event: 'view' | 'search', body: Record<string, unknown>): void {
  post(event === 'view' ? endpoints.track.view : endpoints.track.search, body);
}

export function trackRecommendation(
  type: 'cart' | 'wishlist' | 'impression',
  body: { productId?: string; productIds?: string[] },
): void {
  post(endpoints.track.recs, { type, ...body });
}

/** One view per product per app session - a re-open of the same screen doesn't double count. */
const seen = new Set<string>();
export function firstInSession(key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
