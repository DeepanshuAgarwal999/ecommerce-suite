import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Sliding-window counter over sorted sets.
 *
 * A fixed window lets a caller send `limit` requests at the end of one window and
 * `limit` more at the start of the next - double the intended rate at the boundary.
 * Trimming a sorted set by timestamp gives a true rolling window instead, at the cost
 * of storing one member per request (bounded by the TTL).
 *
 * The whole check runs as one Lua script so it is atomic under concurrency.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, windowMs)
  return {1, limit - count - 1, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retryAfter = 0
if oldest[2] then
  retryAfter = math.ceil((tonumber(oldest[2]) + windowMs - now) / 1000)
end
redis.call('PEXPIRE', key, windowMs)
return {0, 0, retryAfter}
`;

/**
 * Token bucket, for endpoints where short bursts are fine but the sustained rate is
 * not - OTP sends, payment creation, vendor bulk uploads.
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * refillPerSec)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, math.ceil((capacity / refillPerSec) * 1000) + 1000)
return {allowed, math.floor(tokens)}
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry. Feeds the `Retry-After` header. */
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const [allowed, remaining, retryAfter] = await this.redis.eval<number[]>(
        SLIDING_WINDOW_SCRIPT,
        [key],
        [now, windowSeconds * 1000, limit, `${now}-${Math.random().toString(36).slice(2, 10)}`],
      );
      return {
        allowed: allowed === 1,
        remaining: Number(remaining),
        retryAfterSeconds: Number(retryAfter),
      };
    } catch (error) {
      // Fail open: a Redis blip must not lock every customer out of the app.
      this.logger.error(`rate limit check failed for ${key}: ${(error as Error).message}`);
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
  }

  async consumeToken(
    key: string,
    capacity: number,
    refillPerSecond: number,
    cost = 1,
  ): Promise<RateLimitResult> {
    try {
      const [allowed, remaining] = await this.redis.eval<number[]>(
        TOKEN_BUCKET_SCRIPT,
        [key],
        [capacity, refillPerSecond, Date.now(), cost],
      );
      return {
        allowed: allowed === 1,
        remaining: Number(remaining),
        retryAfterSeconds: allowed === 1 ? 0 : Math.ceil(cost / refillPerSecond),
      };
    } catch (error) {
      this.logger.error(`token bucket check failed for ${key}: ${(error as Error).message}`);
      return { allowed: true, remaining: capacity, retryAfterSeconds: 0 };
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
