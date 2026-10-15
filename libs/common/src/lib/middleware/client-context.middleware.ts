import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiVersion,
  ClientInfo,
  ClientSource,
  Headers,
  isBrowserSource,
  isMobileSource,
} from '@ecommerce/contracts';
import type { NextFunction, Request, Response } from 'express';
import { AppException, ErrorCode } from '../errors/app-exception';

/** RFC 7231 426 Upgrade Required - the one status a mobile client can map straight to
 *  "show the force-update dialog". Not present in Nest's HttpStatus enum. */
const HTTP_UPGRADE_REQUIRED = 426;

export type RequestWithClient = Request & { client: ClientInfo };

/** Accepts the header in any case and a few common aliases. */
const SOURCE_ALIASES: Record<string, ClientSource> = {
  android: ClientSource.ANDROID,
  'android-app': ClientSource.ANDROID,
  ios: ClientSource.IOS,
  'ios-app': ClientSource.IOS,
  web: ClientSource.WEB,
  'shop-web': ClientSource.WEB,
  storefront: ClientSource.WEB,
  admin: ClientSource.ADMIN_WEB,
  'admin-web': ClientSource.ADMIN_WEB,
  admin_web: ClientSource.ADMIN_WEB,
  vendor: ClientSource.VENDOR_WEB,
  'vendor-web': ClientSource.VENDOR_WEB,
  vendor_web: ClientSource.VENDOR_WEB,
  api: ClientSource.API,
};

/**
 * Identifies the calling client and stamps the API version on every request.
 *
 * Reads:
 *   X-Client       ANDROID | IOS | WEB | ADMIN_WEB | VENDOR_WEB   (preferred)
 *   X-Platform     android | ios | web                             (fallback hint)
 *   X-App-Version  semver of the app / web build
 *   X-Device-Id    stable per-install id
 *
 * When none are present the source is inferred: a request carrying an `Origin` or a
 * browser user agent is WEB, anything else is API. Inference is a courtesy for curl and
 * old builds; real clients must send `X-Client` so attribution is exact.
 *
 * Also enforces the minimum app version for native apps (426 Upgrade Required) and
 * writes `X-API-Version` on the response so a client can detect drift.
 */
@Injectable()
export class ClientContextMiddleware implements NestMiddleware {
  private readonly minVersions: Partial<Record<ClientSource, string>>;

  constructor(config: ConfigService) {
    this.minVersions = {
      [ClientSource.ANDROID]: config.get<string>('clients.minAndroidVersion') || undefined,
      [ClientSource.IOS]: config.get<string>('clients.minIosVersion') || undefined,
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const client = this.resolve(req);
    (req as RequestWithClient).client = client;

    res.setHeader(Headers.API_VERSION, client.apiVersion);

    if (!ApiVersion.SUPPORTED.includes(client.apiVersion)) {
      throw new AppException(
        ErrorCode.UNSUPPORTED_API_VERSION,
        `API version ${client.apiVersion} is no longer supported. Supported: ${ApiVersion.SUPPORTED.join(', ')}`,
        HttpStatus.GONE,
      );
    }

    const minimum = this.minVersions[client.source];
    if (minimum && client.appVersion && compareSemver(client.appVersion, minimum) < 0) {
      // 426 is the one status a mobile client can treat as "show the update dialog"
      // without ambiguity - nothing else in the API produces it.
      throw new AppException(
        ErrorCode.UPGRADE_REQUIRED,
        'Please update the app to continue',
        HTTP_UPGRADE_REQUIRED,
        { details: { minimumVersion: minimum, currentVersion: client.appVersion } },
      );
    }

    next();
  }

  private resolve(req: Request): ClientInfo {
    const header = (name: string): string | undefined => {
      const value = req.headers[name];
      return typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : undefined;
    };

    const explicit = header(Headers.CLIENT)?.toLowerCase();
    const platform = header(Headers.PLATFORM)?.toLowerCase();
    const userAgent = req.headers['user-agent'] ?? '';

    let source: ClientSource | undefined = explicit ? SOURCE_ALIASES[explicit] : undefined;
    if (!source && platform) source = SOURCE_ALIASES[platform];
    if (!source) {
      const looksLikeBrowser =
        Boolean(req.headers.origin) || /Mozilla\/|Chrome\/|Safari\/|Firefox\//.test(userAgent);
      source = looksLikeBrowser ? ClientSource.WEB : ClientSource.API;
    }

    // Version from the URI (`/api/v2/...`); falls back to the default.
    const match = /\/v(\d+)(?:\/|$)/.exec(req.path);
    const apiVersion = match?.[1] ?? ApiVersion.DEFAULT;

    return {
      source,
      platform: platform ?? (isMobileSource(source) ? source.toLowerCase() : undefined),
      appVersion: header(Headers.APP_VERSION),
      deviceId: header(Headers.DEVICE_ID),
      isBrowser: isBrowserSource(source),
      isMobile: isMobileSource(source),
      apiVersion,
    };
  }
}

/** Numeric semver compare; ignores pre-release tags. Returns <0, 0, >0. */
export function compareSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .split(/[+-]/)[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
