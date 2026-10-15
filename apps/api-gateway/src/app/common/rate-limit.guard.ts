import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AppException } from '@ecommerce/common';
import { AuthenticatedUser, CacheKeys } from '@ecommerce/contracts';
import { RateLimitService } from '@ecommerce/redis';
import type { Request, Response } from 'express';

export const RATE_LIMIT_KEY = 'rate_limit';
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Bucket name; routes sharing a name share a budget. */
  scope?: string;
}

/** Per-route override: `@RateLimit({ limit: 5, windowSeconds: 60 })`. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Redis-backed rate limiting at the edge.
 *
 * Counted in Redis rather than in process memory so the limit holds across every
 * gateway replica - an in-memory limiter multiplies the real ceiling by the number of
 * instances. Authenticated callers are keyed by user id, anonymous ones by IP, and the
 * anonymous budget is tighter because that is where abuse comes from.
 *
 * Applies a global default; sensitive routes (OTP, payment creation) declare their own
 * tighter budget with `@RateLimit`.
 */
@Injectable()
export class GatewayRateLimitGuard implements CanActivate {
  private readonly defaults: RateLimitOptions;
  private readonly anonymousLimit: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
    config: ConfigService,
  ) {
    this.defaults = {
      limit: config.get<number>('throttle.limit', 120),
      windowSeconds: config.get<number>('throttle.ttlSeconds', 60),
      scope: 'global',
    };
    this.anonymousLimit = config.get<number>('throttle.anonymousLimit', 30);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) return true;

    const override = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, targets);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const response = context.switchToHttp().getResponse<Response>();

    const subject = request.user?.userId ?? `ip:${request.ip ?? 'unknown'}`;
    const options = override ?? {
      ...this.defaults,
      limit: request.user ? this.defaults.limit : this.anonymousLimit,
    };

    const result = await this.rateLimit.consume(
      CacheKeys.rateLimit(options.scope ?? 'global', subject),
      options.limit,
      options.windowSeconds,
    );

    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));

    if (!result.allowed) {
      throw AppException.rateLimited(
        'Too many requests. Please slow down.',
        Math.max(1, result.retryAfterSeconds),
      );
    }

    return true;
  }
}
