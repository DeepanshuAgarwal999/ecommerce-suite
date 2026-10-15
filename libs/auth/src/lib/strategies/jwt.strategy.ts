import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthenticatedUser, CacheKeys, JwtPayload } from '@ecommerce/contracts';
import { RedisService } from '@ecommerce/redis';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Verifies the access token and materialises `request.user`.
 *
 * Signature verification alone is not enough. A token stays cryptographically valid
 * until it expires, so logout, a role change and an account ban would all take up to
 * the full access-token lifetime to take effect. Two cheap Redis lookups close that
 * window:
 *
 *  - a block flag, so a banned account is rejected immediately;
 *  - a token version, bumped whenever roles change or the user logs out everywhere,
 *    which invalidates every token issued before the bump.
 *
 * Both are single Redis GETs on an already-open connection, and both fail open on a
 * Redis outage - refusing every logged-in user because a cache is down would be a worse
 * outcome than briefly honouring a stale token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret', ''),
      issuer: config.get<string>('jwt.issuer'),
      audience: config.get<string>('jwt.audience'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) throw new UnauthorizedException('Malformed token');

    const blocked = await this.redis.exists(CacheKeys.blockedUser(payload.sub));
    if (blocked) throw new UnauthorizedException('This account has been suspended');

    const currentVersion = await this.redis.get<number>(CacheKeys.tokenVersion(payload.sub));
    if (currentVersion !== null && currentVersion !== payload.tv) {
      throw new UnauthorizedException('Session is no longer valid, please sign in again');
    }

    return {
      userId: payload.sub,
      mobile: payload.mobile,
      countryCode: payload.countryCode,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      sessionId: payload.sid,
      tokenVersion: payload.tv,
    };
  }
}
