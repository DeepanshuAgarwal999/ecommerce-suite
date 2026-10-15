import { env } from '@/config/env';
import { getAccessToken } from '@/lib/api/auth-bridge';
import { getVisitorId } from '@/lib/visitor';

/** Identity on every beacon: the visitor id always, the bearer token when signed in
 *  (so the recommender can stitch pre-login browsing into the account). */
function beaconHeaders(): Record<string, string> {
  const visitorId = getVisitorId();
  const token = getAccessToken();
  return {
    'content-type': 'application/json',
    'x-client': 'WEB',
    'x-platform': 'web',
    ...(visitorId ? { 'x-visitor-id': visitorId } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function post(path: string, body: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch(`${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: beaconHeaders(),
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // Analytics is best-effort.
  }
}

/**
 * Fire-and-forget analytics beacon to the gateway's /catalog/track/* routes.
 *
 * Events fire on page load (not on exit), so a plain fetch is enough - no
 * `keepalive`/sendBeacon, which have cross-origin JSON quirks in some browsers.
 * Failures are swallowed: analytics must never surface an error or slow a page.
 */
export function track(event: 'view' | 'search', body: Record<string, unknown>): void {
  post(`/catalog/track/${event}`, body);
}

/** Recommender signals that aren't page views: cart adds, wishlist saves, and which
 *  recommended products were actually seen (impressions drive fatigue). */
export function trackRecommendation(
  type: 'cart' | 'wishlist' | 'impression',
  body: { productId?: string; productIds?: string[] },
): void {
  post('/recs/events', { type, ...body });
}

/**
 * True the first time `key` is seen in this browser tab session. Used so a
 * refresh, or bouncing back to the same product, counts as one view - the usual
 * "unique views per session" definition.
 */
export function firstInSession(key: string): boolean {
  try {
    const storageKey = `seen:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}
