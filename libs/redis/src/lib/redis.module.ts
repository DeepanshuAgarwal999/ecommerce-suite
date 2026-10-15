import { DynamicModule, Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster } from 'ioredis';
import { CacheService } from './cache.service';
import { IdempotencyService } from './idempotency.service';
import { LockService } from './lock.service';
import { RateLimitService } from './rate-limit.service';
import { REDIS_CLIENT, REDIS_OPTIONS, REDIS_SUBSCRIBER, RedisModuleOptions } from './redis.constants';
import { RedisService } from './redis.service';

const logger = new Logger('RedisModule');

function createClient(options: RedisModuleOptions): Redis | Cluster {
  const shared = {
    keyPrefix: options.keyPrefix,
    // Queue commands issued before the socket is up instead of throwing at boot.
    enableOfflineQueue: true,
    // Unlimited retries per request turns a brief blip into unbounded latency.
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
    // Exponential-ish backoff, capped, so a downed Redis is not hammered.
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    reconnectOnError: (error: Error) => error.message.includes('READONLY'),
  };

  if (options.cluster && options.clusterNodes?.length) {
    return new Cluster(options.clusterNodes, {
      redisOptions: { password: options.password, ...shared },
      // Send reads to replicas so the primary only takes writes.
      scaleReads: 'slave',
      clusterRetryStrategy: (times: number) => Math.min(times * 200, 5_000),
    });
  }

  if (options.url) return new Redis(options.url, shared);

  return new Redis({
    host: options.host ?? '127.0.0.1',
    port: options.port ?? 6379,
    password: options.password,
    db: options.db ?? 0,
    ...shared,
  });
}

function attachLogging(client: Redis | Cluster, label: string): Redis | Cluster {
  client.on('error', (error: Error) => logger.error(`${label} error: ${error.message}`));
  client.on('connect', () => logger.log(`${label} connected`));
  client.on('reconnecting', () => logger.warn(`${label} reconnecting`));
  return client;
}

/**
 * Global Redis module. Every service imports it once with `forRoot()`; the client,
 * cache, lock, rate-limit and idempotency helpers are then injectable anywhere.
 */
@Global()
@Module({})
export class RedisModule {
  static forRoot(options: RedisModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      { provide: REDIS_OPTIONS, useValue: options },
      {
        provide: REDIS_CLIENT,
        useFactory: () => attachLogging(createClient(options), 'redis'),
      },
      RedisService,
      CacheService,
      LockService,
      RateLimitService,
      IdempotencyService,
    ];

    if (options.enableSubscriber) {
      providers.push({
        provide: REDIS_SUBSCRIBER,
        useFactory: () => attachLogging(createClient(options), 'redis-subscriber'),
      });
    }

    return {
      module: RedisModule,
      providers,
      exports: [
        REDIS_CLIENT,
        ...(options.enableSubscriber ? [REDIS_SUBSCRIBER] : []),
        RedisService,
        CacheService,
        LockService,
        RateLimitService,
        IdempotencyService,
      ],
    };
  }

  /** Reads connection details from `ConfigService` instead of hard-coded options. */
  static forRootAsync(overrides: Partial<RedisModuleOptions> = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: REDIS_OPTIONS,
        inject: [ConfigService],
        useFactory: (config: ConfigService): RedisModuleOptions => ({
          url: config.get<string>('redis.url'),
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          db: config.get<number>('redis.db'),
          keyPrefix: config.get<string>('redis.keyPrefix'),
          cluster: config.get<boolean>('redis.cluster'),
          ...overrides,
        }),
      },
      {
        provide: REDIS_CLIENT,
        inject: [REDIS_OPTIONS],
        useFactory: (options: RedisModuleOptions) => attachLogging(createClient(options), 'redis'),
      },
      RedisService,
      CacheService,
      LockService,
      RateLimitService,
      IdempotencyService,
    ];

    return {
      module: RedisModule,
      providers,
      exports: [
        REDIS_CLIENT,
        RedisService,
        CacheService,
        LockService,
        RateLimitService,
        IdempotencyService,
      ],
    };
  }
}
