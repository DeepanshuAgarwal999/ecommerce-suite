/**
 * Every message on the bus is wrapped in this envelope.
 *
 * `eventId` is what makes consumers idempotent: a consumer records the ids it has
 * already applied, so a Kafka redelivery (which will happen - delivery is at-least-once)
 * turns into a no-op instead of a duplicate order or a double refund.
 */
export interface EventEnvelope<TPayload = unknown> {
  /** Unique per emission. Consumers dedupe on this. */
  eventId: string;
  /** Topic-level type, e.g. `order.created`. Mirrors the Kafka topic. */
  eventType: string;
  /** Bumped when the payload shape changes in a way consumers must branch on. */
  eventVersion: number;
  /** ISO-8601 UTC timestamp of when the fact happened, not when it was published. */
  occurredAt: string;
  /** Service that emitted it, e.g. `order-service`. */
  producer: string;
  /** Ties every event in one user-visible operation together across services. */
  correlationId: string;
  /** The eventId (or request id) that caused this one - lets you rebuild a causal chain. */
  causationId?: string;
  /** Aggregate id used as the Kafka partition key; guarantees per-aggregate ordering. */
  partitionKey: string;
  /** Actor who triggered the change, when there is one. */
  actorId?: string;
  /** Client source of the originating request (ANDROID, WEB, ...), for attribution. */
  source?: string;
  payload: TPayload;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  actorId?: string;
  source?: string;
  eventVersion?: number;
  occurredAt?: Date | string;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<EventEnvelope>;
  return (
    typeof candidate.eventId === 'string' &&
    typeof candidate.eventType === 'string' &&
    typeof candidate.partitionKey === 'string' &&
    'payload' in candidate
  );
}
