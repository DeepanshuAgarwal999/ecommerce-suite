import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientInfo, TokenPair } from '@ecommerce/contracts';
import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE = 'ecom_refresh';

/**
 * Refresh-token transport that differs by client.
 *
 * A native app has secure storage (Keystore / Keychain), so it receives the refresh
 * token in the JSON body and stores it itself. A browser has nothing equivalent: any
 * token JavaScript can read, a cross-site-scripting bug can steal. So for web clients
 * the refresh token goes into an httpOnly, SameSite cookie scoped to the auth path -
 * unreadable from JavaScript, sent only to `/auth/*`, and never on a cross-site request.
 *
 * The access token is always in the body. It is short-lived and the storefront keeps it
 * in memory only; a page reload simply calls `/auth/refresh`, which the cookie carries.
 */
@Injectable()
export class AuthCookieService {
  private readonly cookieOptions: CookieOptions;
  private readonly maxAgeMs: number;

  constructor(config: ConfigService) {
    const prefix = config.get<string>('http.globalPrefix', 'api');
    this.maxAgeMs = parseDuration(config.get<string>('jwt.refreshTtl', '30d'));
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get<boolean>('clients.cookieSecure', false),
      sameSite: config.get<'lax' | 'strict' | 'none'>('clients.cookieSameSite', 'lax'),
      domain: config.get<string>('clients.cookieDomain'),
      // Only ever sent to the auth routes. The cookie is useless to every other endpoint,
      // so there is no reason to let it travel with product page requests.
      path: `/${prefix}/v1/auth`,
    };
  }

  /**
   * Shapes an auth response for the calling client. Browsers get the cookie and a body
   * without the refresh token; apps get the body as-is.
   */
  deliver<T extends TokenPair>(response: Response, client: ClientInfo | undefined, tokens: T): T {
    if (!client?.isBrowser) return tokens;

    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions,
      maxAge: this.maxAgeMs,
    });

    // Strip the token from the body so it never lands in web storage or a log.
    return { ...tokens, refreshToken: '' };
  }

  /** Reads the refresh token from the body (apps) or the cookie (web), body first. */
  extract(request: Request, bodyToken?: string): string | undefined {
    if (bodyToken) return bodyToken;
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE];
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) return 30 * 86_400_000;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * (multipliers[match[2] ?? 's'] ?? 1000);
}
