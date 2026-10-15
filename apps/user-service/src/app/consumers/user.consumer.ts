import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  UserRegisteredPayload,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';

/**
 * Reacts to identity events from auth-service.
 *
 * Every handler here is idempotent, because Kafka delivers at least once. The dedupe is
 * two-layer: Redis for speed on the hot path, and a `ProcessedEvent` row as the durable
 * backstop so a cache flush cannot cause an event to be applied twice.
 */
@Injectable()
export class UserConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly profiles: ProfileService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      {
        groupId: ConsumerGroups.USER_SYNC,
        topics: [KafkaTopics.USER_REGISTERED],
      },
      {
        [KafkaTopics.USER_REGISTERED]: (envelope) =>
          this.handleOnce(envelope as EventEnvelope, () =>
            this.onUserRegistered(envelope as EventEnvelope<UserRegisteredPayload>),
          ),
      },
    );
  }

  private async onUserRegistered(envelope: EventEnvelope<UserRegisteredPayload>): Promise<void> {
    const { userId, mobile, countryCode, email, referralCode } = envelope.payload;
    await this.profiles.syncFromAuth({ userId, mobile, countryCode, email, referralCode });
  }

  /**
   * Runs `handler` at most once per eventId for this consumer group.
   *
   * The Redis claim short-circuits the common case. The database row is written after
   * success and checked on the slow path, so the guarantee survives Redis being wiped.
   */
  private async handleOnce(envelope: EventEnvelope, handler: () => Promise<void>): Promise<void> {
    const group = ConsumerGroups.USER_SYNC;
    const fresh = await this.idempotency.markEventProcessed(group, envelope.eventId);

    if (!fresh) {
      this.logger.debug(`skipping duplicate event ${envelope.eventId}`);
      return;
    }

    const alreadyApplied = await this.prisma.processedEvent.findUnique({
      where: { eventId: envelope.eventId },
      select: { eventId: true },
    });
    if (alreadyApplied) return;

    await handler();

    await this.prisma.processedEvent.create({
      data: { eventId: envelope.eventId, consumerGroup: group },
    });
  }
}
