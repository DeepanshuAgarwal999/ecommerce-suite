import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheOptions {
  ttlSeconds: number;
  /**
   * Random extra TTL, as a fraction of the base. Without it, a batch of keys written
   * together expires together, and the next request storms the database - a cache
   * stampede. 10-20% jitter spreads those expiries out.
   */
  jitterRatio?: number;
}

/**
 * Cache-aside helper.
 *
 * Reads check Redis, fall through to the loader on a miss, then populate. In-flight
 * misses for the same key are coalesced in-process so a hot key that expires triggers
 * one database query per instance instead of one per concurrent request.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly redis: RedisService) {}

  private withJitter({ ttlSeconds, jitterRatio = 0.15 }: CacheOptions): number {
    const jitter = Math.floor(ttlSeconds * jitterRatio * Math.random());
    return ttlSeconds + jitter;
  }

  async wrap<T>(key: string, loader: () => Promise<T>, options: CacheOptions): Promise<T> {
    const cached = await this.redis.get<T>(key);
    if (cached !== null) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = (async () => {
      try {
        const value = await loader();
        // Caching null would turn a transient miss into a persistent one.
        if (value !== null && value !== undefined) {
          await this.redis.set(key, value, this.withJitter(options));
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Multi-key cache-aside. Fetches every hit in one MGET and asks the loader only for
   * the ids that missed - the pattern behind product listing and price lookups.
   */
  async wrapMany<T>(
    ids: string[],
    keyFor: (id: string) => string,
    loader: (missingIds: string[]) => Promise<Map<string, T>>,
    options: CacheOptions,
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    if (ids.length === 0) return result;

    const keys = ids.map(keyFor);
    const cached = await this.redis.mget<T>(keys);

    const missing: string[] = [];
    ids.forEach((id, index) => {
      const value = cached[index];
      if (value === null) missing.push(id);
      else result.set(id, value);
    });

    if (missing.length > 0) {
      const loaded = await loader(missing);
      const writes: { key: string; value: unknown; ttlSeconds: number }[] = [];
      for (const [id, value] of loaded) {
        result.set(id, value);
        writes.push({ key: keyFor(id), value, ttlSeconds: this.withJitter(options) });
      }
      await this.redis.mset(writes);
    }

    return result;
  }

  async invalidate(...keys: string[]): Promise<void> {
    await this.redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const count = await this.redis.deleteByPattern(pattern);
    if (count > 0) this.logger.debug(`invalidated ${count} keys matching ${pattern}`);
  }
}
