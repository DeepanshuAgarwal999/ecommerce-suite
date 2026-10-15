import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { CacheKeys, CacheTtl, JwtPayload, Role, TokenPair, permissionsForRoles } from '@ecommerce/contracts';
import { AppException, ErrorCode, sha256 } from '@ecommerce/common';
import { RedisService } from '@ecommerce/redis';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface IssueTokenInput {
  identityId: string;
  mobile: string;
  countryCode: string;
  email?: string | null;
  roles: Role[];
  tokenVersion: number;
  device?: {
    deviceId?: string;
    platform?: 'ANDROID' | 'IOS' | 'WEB';
    /** Client source (ANDROID, IOS, WEB, ADMIN_WEB, VENDOR_WEB). */
    source?: string;
    appVersion?: string;
    userAgent?: string;
    ip?: string;
  };
}

/**
 * Mints, rotates and revokes tokens.
 *
 * Split-lifetime design: a short-lived access token that is verified purely by
 * signature (no database call, which is what lets the gateway handle high request
 * volume), and a long-lived refresh token that *is* stored, so it can be revoked.
 *
 * The refresh token is stored as a SHA-256 hash. A leaked `sessions` table then yields
 * nothing usable - the same reason password hashes exist. SHA-256 rather than bcrypt
 * here because the token is already 256 bits of entropy; there is nothing to brute
 * force, and refresh happens often enough that bcrypt's cost would be felt.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.accessTtl = config.get<string>('jwt.accessTtl', '15m');
    this.refreshTtl = config.get<string>('jwt.refreshTtl', '30d');
    this.refreshTtlMs = this.parseDuration(this.refreshTtl);
  }

  async issue(input: IssueTokenInput): Promise<TokenPair & { sessionId: string }> {
    const sessionId = randomUUID();
    const refreshToken = this.generateRefreshToken();

    const payload: JwtPayload = {
      sub: input.identityId,
      mobile: input.mobile,
      countryCode: input.countryCode,
      email: input.email ?? undefined,
      roles: input.roles,
      // Permissions are expanded at mint time so the gateway never has to look up the
      // role -> permission mapping on the request path.
      permissions: permissionsForRoles(input.roles),
      sid: sessionId,
      tv: input.tokenVersion,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'],
      // Must match what JwtStrategy (libs/auth) verifies against on every other
      // service. Omitting these here is silent at sign time and fails every request
      // at the gateway with a generic "invalid token" - there is no local test that
      // would have caught it, since this service never verifies its own tokens.
      issuer: this.config.get<string>('jwt.issuer'),
      audience: this.config.get<string>('jwt.audience'),
      jwtid: randomUUID(),
    });

    await this.prisma.session.create({
      data: {
        id: sessionId,
        identityId: input.identityId,
        refreshTokenHash: sha256(refreshToken),
        deviceId: input.device?.deviceId,
        platform: input.device?.platform,
        source: input.device?.source,
        appVersion: input.device?.appVersion,
        userAgent: input.device?.userAgent?.slice(0, 400),
        ip: input.device?.ip,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    // Mirror the token version into Redis so the gateway's JWT strategy can check it
    // without reaching into this service's database.
    await this.redis.set(
      CacheKeys.tokenVersion(input.identityId),
      input.tokenVersion,
      CacheTtl.SESSION,
    );
    await this.redis.sadd(CacheKeys.userSessions(input.identityId), sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(this.parseDuration(this.accessTtl) / 1000),
      tokenType: 'Bearer',
      sessionId,
    };
  }

  /**
   * Exchanges a refresh token for a new pair, rotating the old one.
   *
   * Rotation matters: if a refresh token is stolen, both the attacker and the real user
   * will eventually present the same token. The second presentation hits a revoked row,
   * which we treat as a compromise signal and use to kill every session on the account.
   */
  async rotate(
    refreshToken: string,
    device?: IssueTokenInput['device'],
  ): Promise<TokenPair & { sessionId: string }> {
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { identity: true },
    });

    if (!session) {
      throw AppException.unauthenticated('Invalid refresh token', ErrorCode.TOKEN_REVOKED);
    }

    if (session.revokedAt) {
      this.logger.warn(
        `refresh token reuse detected for identity ${session.identityId}; revoking all sessions`,
      );
      await this.revokeAll(session.identityId, 'refresh_token_reuse');
      throw AppException.unauthenticated(
        'This session was ended for security reasons. Please sign in again.',
        ErrorCode.TOKEN_REVOKED,
      );
    }

    if (session.expiresAt < new Date()) {
      throw AppException.unauthenticated('Session expired, please sign in again', ErrorCode.TOKEN_EXPIRED);
    }

    if (session.identity.status !== 'ACTIVE') {
      throw AppException.unauthenticated('This account has been suspended', ErrorCode.ACCOUNT_BLOCKED);
    }

    const next = await this.issue({
      identityId: session.identityId,
      mobile: session.identity.mobile,
      countryCode: session.identity.countryCode,
      email: session.identity.email,
      roles: session.identity.roles,
      tokenVersion: session.identity.tokenVersion,
      device: {
        deviceId: device?.deviceId ?? session.deviceId ?? undefined,
        platform: device?.platform ?? session.platform ?? undefined,
        // Source is sticky across rotations: a session that started on web stays web.
        source: device?.source ?? session.source ?? undefined,
        appVersion: device?.appVersion ?? session.appVersion ?? undefined,
        userAgent: device?.userAgent,
        ip: device?.ip,
      },
    });

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedBySessionId: next.sessionId,
      },
    });
    await this.redis.srem(CacheKeys.userSessions(session.identityId), session.id);

    return next;
  }

  async revoke(sessionId: string, identityId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, identityId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.srem(CacheKeys.userSessions(identityId), sessionId);
  }

  /**
   * Ends every session on the account. Bumping `tokenVersion` is what makes already
   * issued access tokens stop working immediately, rather than lingering until they
   * expire.
   */
  async revokeAll(identityId: string, reason: string): Promise<void> {
    const [identity] = await this.prisma.$transaction([
      this.prisma.identity.update({
        where: { id: identityId },
        data: { tokenVersion: { increment: 1 } },
      }),
      this.prisma.session.updateMany({
        where: { identityId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.redis.set(
      CacheKeys.tokenVersion(identityId),
      identity.tokenVersion,
      CacheTtl.SESSION,
    );
    await this.redis.del(CacheKeys.userSessions(identityId));
    this.logger.log(`revoked all sessions for ${identityId} (${reason})`);
  }

  /** 256 bits from the OS CSPRNG - not guessable, and no database lookup to validate. */
  private generateRefreshToken(): string {
    return `${randomUUID()}.${randomUUID()}`.replace(/-/g, '');
  }

  /** Converts `15m` / `30d` / `3600` into milliseconds. */
  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])?$/.exec(value.trim());
    if (!match) return 900_000;
    const amount = Number(match[1]);
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return amount * (multipliers[match[2] ?? 's'] ?? 1000);
  }
}
