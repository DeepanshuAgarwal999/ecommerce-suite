import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from './redis.service';

type IdempotencyState = 'IN_PROGRESS' | 'COMPLETED';

interface IdempotencyRecord<T> {
  state: IdempotencyState;
  /** Hash of the request body - a replay with different content is a client bug, not a retry. */
  fingerprint: string;
  response?: T;
  createdAt: number;
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Idempotency keys for unsafe operations.
 *
 * Mobile clients retry aggressively on flaky networks. Without this, a retried
 * "place order" or "start payment" creates a second order. The first request claims the
 * key, later ones either wait for it or replay the stored response.
 *
 * Redis holds the hot path; anything that must survive a Redis flush (payments, orders)
 * additionally carries a unique constraint in Postgres as the real backstop.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly redis: RedisService) {}

  private key(scope: string, key: string): string {
    return `idem:${scope}:${key}`;
  }

  private fingerprint(payload: unknown): string {
    // Stable stringify so key order in the body does not change the hash.
    const normalise = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalise);
      if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = normalise((value as Record<string, unknown>)[k]);
            return acc;
          }, {});
      }
      return value;
    };
    return createHash('sha256').update(JSON.stringify(normalise(payload))).digest('hex');
  }

  /**
   * Runs `handler` at most once per (scope, key). Returns the stored response on replay.
   * `null` key means the caller did not send one - we just run the handler.
   */
  async execute<T>(
    scope: string,
    key: string | undefined | null,
    payload: unknown,
    handler: () => Promise<T>,
    ttlSeconds = 86400,
  ): Promise<T> {
    if (!key) return handler();

    const redisKey = this.key(scope, key);
    const fingerprint = this.fingerprint(payload);

    const claimed = await this.redis.setIfAbsent(
      redisKey,
      { state: 'IN_PROGRESS', fingerprint, createdAt: Date.now() } satisfies IdempotencyRecord<T>,
      ttlSeconds,
    );

    if (!claimed) {
      const existing = await this.redis.get<IdempotencyRecord<T>>(redisKey);

      if (existing && existing.fingerprint !== fingerprint) {
        throw new IdempotencyConflictError(
          'This idempotency key was already used with a different request body.',
        );
      }

      if (existing?.state === 'COMPLETED') return existing.response as T;

      // Another request is mid-flight. Poll briefly rather than duplicating the work.
      const settled = await this.waitForCompletion<T>(redisKey);
      if (settled) return settled;

      throw new IdempotencyConflictError('A request with this idempotency key is still running.');
    }

    try {
      const response = await handler();
      await this.redis.set(
        redisKey,
        { state: 'COMPLETED', fingerprint, response, createdAt: Date.now() },
        ttlSeconds,
      );
      return response;
    } catch (error) {
      // Release the claim so a genuine retry can succeed after a transient failure.
      await this.redis.del(redisKey);
      throw error;
    }
  }

  private async waitForCompletion<T>(
    redisKey: string,
    attempts = 20,
    delayMs = 150,
  ): Promise<T | null> {
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const record = await this.redis.get<IdempotencyRecord<T>>(redisKey);
      if (record?.state === 'COMPLETED') return record.response as T;
      if (!record) return null;
    }
    return null;
  }

  /**
   * Consumer-side dedupe. Returns true the first time an eventId is seen by a consumer
   * group, false on every redelivery.
   */
  async markEventProcessed(group: string, eventId: string, ttlSeconds = 259200): Promise<boolean> {
    return this.redis.setIfAbsent(`evt:${group}:${eventId}`, 1, ttlSeconds);
  }

  /**
   * Undo `markEventProcessed` when the handler FAILED. The marker is taken before the
   * handler runs (so two replicas can't process the same event at once); if it stayed
   * after a failure, the consumer's own retry - and every Kafka redelivery for three
   * days - would see "already processed" and skip it, so the event would never be
   * applied. Every handleOnce must call this in its catch block.
   */
  async releaseEvent(group: string, eventId: string): Promise<void> {
    await this.redis.del(`evt:${group}:${eventId}`);
  }
}
