import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

/**
 * Releases the lock only if we still own it. Comparing the token first stops a slow
 * holder - one that overran its TTL - from deleting the lock a different worker has
 * since acquired.
 */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;

const EXTEND_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
else
  return 0
end`;

export interface LockOptions {
  /** Lock lifetime. Must exceed the worst-case critical section or it self-releases early. */
  ttlSeconds?: number;
  /** How long to keep retrying before giving up. 0 means fail fast. */
  waitMs?: number;
  retryDelayMs?: number;
}

export interface AcquiredLock {
  key: string;
  token: string;
  release: () => Promise<boolean>;
  extend: (ttlSeconds: number) => Promise<boolean>;
}

/**
 * Single-node distributed lock (SET NX PX + fenced release).
 *
 * Used for things that must not run concurrently across instances: outbox draining,
 * scheduled sweeps, one-shot promo redemption. It is not a substitute for a database
 * transaction - anything that must be exactly-once should also be idempotent.
 */
@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, options: LockOptions = {}): Promise<AcquiredLock | null> {
    const { ttlSeconds = 30, waitMs = 0, retryDelayMs = 50 } = options;
    const token = randomUUID();
    const deadline = Date.now() + waitMs;

    for (;;) {
      const acquired = await this.redis.setIfAbsent(key, token, ttlSeconds);
      if (acquired) {
        return {
          key,
          token,
          release: () => this.release(key, token),
          extend: (seconds: number) => this.extend(key, token, seconds),
        };
      }
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  async release(key: string, token: string): Promise<boolean> {
    try {
      const result = await this.redis.eval<number>(RELEASE_SCRIPT, [key], [JSON.stringify(token)]);
      return result === 1;
    } catch (error) {
      this.logger.warn(`release(${key}) failed: ${(error as Error).message}`);
      return false;
    }
  }

  async extend(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.eval<number>(
        EXTEND_SCRIPT,
        [key],
        [JSON.stringify(token), ttlSeconds],
      );
      return result === 1;
    } catch {
      return false;
    }
  }

  /** Runs `fn` under the lock, or returns null if the lock could not be taken. */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T | null> {
    const lock = await this.acquire(key, options);
    if (!lock) return null;
    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }
}
