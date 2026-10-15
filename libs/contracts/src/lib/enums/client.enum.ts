// See the note in role.enum.ts for why these are const objects rather than `enum`.

/**
 * Where a request came from.
 *
 * The same backend serves the Android/iOS apps, the customer web storefront, the admin
 * console and the vendor portal. Knowing the source on every request is what makes it
 * possible to: key rate limits sensibly, choose web-safe token handling (httpOnly cookie)
 * versus mobile token handling (secure storage), enforce minimum app versions, and
 * attribute orders and sessions in analytics.
 *
 * Sent by clients as the `X-Client` header. Inferred as WEB or API when absent.
 */
export const ClientSource = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  /** Customer storefront (Next.js). */
  WEB: 'WEB',
  /** Back-office console. */
  ADMIN_WEB: 'ADMIN_WEB',
  /** Seller portal. */
  VENDOR_WEB: 'VENDOR_WEB',
  /** Server-to-server, scripts, or an unidentified caller. */
  API: 'API',
} as const;

export type ClientSource = (typeof ClientSource)[keyof typeof ClientSource];

export const ALL_CLIENT_SOURCES: ClientSource[] = Object.values(ClientSource);

/** Sources that are browsers. Drives cookie-based refresh tokens and CORS handling. */
export const BROWSER_SOURCES: readonly ClientSource[] = [
  ClientSource.WEB,
  ClientSource.ADMIN_WEB,
  ClientSource.VENDOR_WEB,
];

/** Sources that are native apps. Drives minimum-version enforcement. */
export const MOBILE_SOURCES: readonly ClientSource[] = [ClientSource.ANDROID, ClientSource.IOS];

export const isBrowserSource = (source: ClientSource | undefined): boolean =>
  source !== undefined && BROWSER_SOURCES.includes(source);

export const isMobileSource = (source: ClientSource | undefined): boolean =>
  source !== undefined && MOBILE_SOURCES.includes(source);

/**
 * API versioning.
 *
 * Versioned in the URI (`/api/v1/...`) because it is the one scheme every HTTP client -
 * a browser `fetch`, an Android OkHttp client, a curl one-liner - handles identically,
 * and because it is visible in access logs. A breaking change ships as a new controller
 * decorated `@Version('2')`; v1 keeps serving until every app build below the cutoff
 * has drained, which `MIN_APP_VERSION_*` lets you force.
 */
export const ApiVersion = {
  /** Version served when a client does not specify one. */
  DEFAULT: '1',
  /** Versions currently accepted. Remove an entry to retire it. */
  SUPPORTED: ['1'] as readonly string[],
} as const;

/** Parsed client identity, attached to the request by the gateway. */
export interface ClientInfo {
  source: ClientSource;
  /** Raw platform hint (`android`, `ios`, `web`), when sent. */
  platform?: string;
  /** Semantic version of the calling app or web build, when sent. */
  appVersion?: string;
  deviceId?: string;
  /** True for any browser source - selects cookie-based refresh tokens. */
  isBrowser: boolean;
  isMobile: boolean;
  /** API version resolved for this request. */
  apiVersion: string;
}
