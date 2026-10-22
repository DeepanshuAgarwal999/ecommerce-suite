import type { Href } from 'expo-router';

/**
 * CMS content (banners, tiles, section "view all") stores *web* paths, because
 * the admin console authors them for the storefront. This maps them onto app
 * routes so one banner works on both. Unknown paths fall back to search, never
 * to a dead screen.
 *
 *   /c/:slug       -> /category/:slug (deepest segment for /c/parent/child)
 *   /p/:slug       -> /product/:slug
 *   /search?q=...  -> /search?q=...
 *   /cart, /account/... -> the matching tab / screen
 *   https://...    -> null; the caller opens external links with Linking
 */
export function resolveCmsLink(url: string | null | undefined): Href | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return null;

  const [path = '', query = ''] = url.split('?');
  const segments = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParamsLite(query).entries());

  switch (segments[0]) {
    case undefined:
      return '/';
    case 'c':
      return segments[1] && segments[1] !== 'all'
        ? { pathname: '/category/[slug]', params: { slug: segments[segments.length - 1]! } }
        : '/categories';
    case 'p':
      return segments[1] ? { pathname: '/product/[slug]', params: { slug: segments[1] } } : null;
    case 'search':
      return { pathname: '/search', params: params.q ? { q: params.q } : {} };
    case 'cart':
      return '/cart';
    case 'account':
      return '/account';
    default:
      return { pathname: '/search', params: { q: segments.join(' ').replace(/-/g, ' ') } };
  }
}

/** Minimal query parser - URLSearchParams in Hermes lacks some methods on older builds. */
class URLSearchParamsLite {
  private readonly pairs: [string, string][];

  constructor(query: string) {
    this.pairs = query
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const [key = '', value = ''] = pair.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' '))];
      });
  }

  entries(): [string, string][] {
    return this.pairs;
  }
}
