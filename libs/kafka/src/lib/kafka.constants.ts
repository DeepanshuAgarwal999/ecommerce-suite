import type { logLevel, SASLOptions } from 'kafkajs';

export const KAFKA_CLIENT = 'KAFKA_CLIENT';
export const KAFKA_OPTIONS = 'KAFKA_OPTIONS';

export interface KafkaModuleOptions {
  /** Shows up in Kafka's own logs and metrics - always the service name. */
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: SASLOptions;
  logLevel?: logLevel;
  connectionTimeout?: number;
  requestTimeout?: number;
  producer?: {
    /**
     * Exactly-once-ish producing: Kafka drops duplicate sends caused by internal
     * retries. Costs a little throughput and is worth it for money-adjacent events.
     */
    idempotent?: boolean;
    /** -1 (all) waits for every in-sync replica. Anything less can lose writes. */
    acks?: number;
    compression?: boolean;
    /** Batching window. Higher = fewer, larger requests = more throughput, more latency. */
    lingerMs?: number;
  };
  consumer?: {
    sessionTimeout?: number;
    heartbeatInterval?: number;
    /** Cap on records handed to a handler at once; bounds memory per partition. */
    maxBytesPerPartition?: number;
    /** Retries inside the consumer before a message is sent to the retry topic. */
    retries?: number;
  };
}

export interface ConsumerRegistration {
  groupId: string;
  topics: string[];
  fromBeginning?: boolean;
  /** Run partitions of the same consumer concurrently. Ordering is kept per partition. */
  partitionConcurrency?: number;
  /** Times to retry in-process before publishing to `<topic>.retry`. */
  maxRetries?: number;
  /** After the retry topic is exhausted the message lands in `<topic>.dlq`. */
  deadLetter?: boolean;
}
