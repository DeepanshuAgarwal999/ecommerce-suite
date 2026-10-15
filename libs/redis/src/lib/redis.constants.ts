export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';
export const REDIS_OPTIONS = 'REDIS_OPTIONS';

export interface RedisModuleOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  /** Prefixed onto every key so several services can share one Redis in dev. */
  keyPrefix?: string;
  /** Set true when pointing at a Redis Cluster instead of a single node. */
  cluster?: boolean;
  clusterNodes?: { host: string; port: number }[];
  /** Opens a second connection for pub/sub, which cannot share the command connection. */
  enableSubscriber?: boolean;
}
