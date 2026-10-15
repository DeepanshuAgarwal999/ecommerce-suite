import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Thin wrapper over the ioredis client.
 *
 * Every method swallows connection errors and degrades to "cache miss" rather than
 * throwing. A Redis outage should make the platform slower, not broken - the callers
 * all have a database fallback behind them.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) readonly client: Redis | Cluster) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`get(${key}) failed: ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, raw, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, raw);
      }
      return true;
    } catch (error) {
      this.logger.warn(`set(${key}) failed: ${(error as Error).message}`);
      return false;
    }
  }

  /** SET NX - returns false when the key already exists. The basis of locks and dedupe. */
  async setIfAbsent(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`setIfAbsent(${key}) failed: ${(error as Error).message}`);
      return false;
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(`del failed: ${(error as Error).message}`);
      return 0;
    }
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    try {
      const raws = await this.client.mget(...keys);
      return raws.map((raw) => (raw === null ? null : (JSON.parse(raw) as T)));
    } catch (error) {
      this.logger.warn(`mget failed: ${(error as Error).message}`);
      return keys.map(() => null);
    }
  }

  /** Writes many keys in one round trip. Each gets its own TTL via a pipeline. */
  async mset(entries: { key: string; value: unknown; ttlSeconds?: number }[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      const pipeline = this.client.pipeline();
      for (const { key, value, ttlSeconds } of entries) {
        const raw = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) pipeline.set(key, raw, 'EX', ttlSeconds);
        else pipeline.set(key, raw);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`mset failed: ${(error as Error).message}`);
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const value = await this.client.incr(key);
      // Only arm the TTL on the first increment, otherwise the window never closes.
      if (value === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
      return value;
    } catch (error) {
      this.logger.warn(`incr(${key}) failed: ${(error as Error).message}`);
      return 0;
    }
  }

  async decrBy(key: string, amount: number): Promise<number> {
    try {
      return await this.client.decrby(key, amount);
    } catch {
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch {
      return -2;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1;
    } catch {
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.expire(key, ttlSeconds);
    } catch {
      /* non-fatal */
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch {
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch {
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch {
      return [];
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch {
      return {};
    }
  }

  async hset(key: string, values: Record<string, string | number>): Promise<void> {
    try {
      await this.client.hset(key, values);
    } catch {
      /* non-fatal */
    }
  }

  /**
   * Deletes by pattern using SCAN, never KEYS. `KEYS *` blocks the single-threaded
   * server for the whole scan, which on a large keyspace is an outage.
   */
  async deleteByPattern(pattern: string, batchSize = 500): Promise<number> {
    let deleted = 0;
    try {
      const nodes = 'nodes' in this.client ? (this.client as Cluster).nodes('master') : [null];
      for (const node of nodes) {
        const target = (node ?? this.client) as Redis;
        let cursor = '0';
        do {
          const [next, keys] = await target.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
          cursor = next;
          if (keys.length > 0) deleted += await this.client.del(...keys);
        } while (cursor !== '0');
      }
    } catch (error) {
      this.logger.warn(`deleteByPattern(${pattern}) failed: ${(error as Error).message}`);
    }
    return deleted;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async eval<T = unknown>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    return (await this.client.eval(script, keys.length, ...keys, ...args)) as T;
  }
}
