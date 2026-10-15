import { Role, Permission } from '../enums/role.enum';
import { ClientSource } from '../enums/client.enum';

/**
 * The decoded JWT. Roles and permissions travel inside the token so the gateway can
 * authorise a request without calling auth-service - the difference between one network
 * hop per request and none, which is the whole ballgame at high request volume.
 */
export interface JwtPayload {
  /** userId */
  sub: string;
  mobile: string;
  countryCode: string;
  email?: string;
  roles: Role[];
  permissions: Permission[];
  /** Session id, so a single device can be revoked without nuking every login. */
  sid: string;
  /** Bumped when roles change or the account is blocked; stale tokens fail the check. */
  tv: number;
  iat?: number;
  exp?: number;
  jti?: string;
}

/** Shape attached to `request.user` after the JWT guard runs. */
export interface AuthenticatedUser {
  userId: string;
  mobile: string;
  countryCode: string;
  email?: string;
  roles: Role[];
  permissions: Permission[];
  sessionId: string;
  tokenVersion: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Cursor pagination for feeds. Offset pagination degrades badly once a table is deep -
 * `OFFSET 200000` still scans 200k rows - so listing endpoints that users scroll use
 * a keyset cursor instead.
 */
export interface CursorPaginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RequestContext {
  correlationId: string;
  userId?: string;
  roles?: Role[];
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  /** Which client made the call - travels into sessions, orders and events. */
  source?: ClientSource;
  platform?: string;
  appVersion?: string;
  apiVersion?: string;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}
