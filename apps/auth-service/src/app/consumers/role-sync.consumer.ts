import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  CacheKeys,
  CacheTtl,
  ConsumerGroups,
  EventEnvelope,
  KafkaTopics,
  Role,
  VendorLifecyclePayload,
  VendorStatus,
} from '@ecommerce/contracts';
import { KafkaConsumerService } from '@ecommerce/kafka';
import { IdempotencyService, RedisService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

const VENDOR_STATUS_TOPICS = [
  KafkaTopics.VENDOR_APPROVED,
  KafkaTopics.VENDOR_REJECTED,
  KafkaTopics.VENDOR_SUSPENDED,
];

/**
 * Keeps the VENDOR role in step with user-service's vendor review decision.
 *
 * user-service owns vendor status and publishes it on approve/reject/suspend; this is
 * the other half of that contract - without it, an approved seller's JWT never gains
 * Role.VENDOR and every @Roles(Role.VENDOR) route on the gateway (the whole partner
 * console) stays 403 forever.
 */
@Injectable()
export class RoleSyncConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleSyncConsumer.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.subscribe(
      { groupId: ConsumerGroups.AUTH_ROLE_SYNC, topics: VENDOR_STATUS_TOPICS },
      Object.fromEntries(
        VENDOR_STATUS_TOPICS.map((topic) => [
          topic,
          (envelope: EventEnvelope<VendorLifecyclePayload>) => this.handleOnce(envelope),
        ]),
      ),
    );
  }

  private async handleOnce(envelope: EventEnvelope<VendorLifecyclePayload>): Promise<void> {
    const processed = await this.idempotency.markEventProcessed(
      ConsumerGroups.AUTH_ROLE_SYNC,
      envelope.eventId,
    );
    if (!processed) {
      this.logger.debug(`skipping duplicate event ${envelope.eventId}`);
      return;
    }
    try {
      await this.onVendorStatusChanged(envelope.payload);
    } catch (error) {
      // Let the retry / redelivery actually re-run it (see IdempotencyService.releaseEvent).
      await this.idempotency.releaseEvent(ConsumerGroups.AUTH_ROLE_SYNC, envelope.eventId);
      throw error;
    }
  }

  private async onVendorStatusChanged(payload: VendorLifecyclePayload): Promise<void> {
    const { userId, status } = payload;
    const shouldHaveRole = status === VendorStatus.APPROVED;

    const identity = await this.prisma.identity.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!identity) {
      this.logger.warn(`vendor status event for unknown identity ${userId}`);
      return;
    }

    const hasRole = identity.roles.includes(Role.VENDOR);
    if (hasRole === shouldHaveRole) return;

    const nextRoles = shouldHaveRole
      ? [...identity.roles, Role.VENDOR]
      : identity.roles.filter((role) => role !== Role.VENDOR);

    const updated = await this.prisma.identity.update({
      where: { id: userId },
      data: { roles: nextRoles, tokenVersion: { increment: 1 } },
    });

    // Already-issued access tokens embed the old tokenVersion. JwtStrategy compares it
    // against this cached value on every request, so the next one 401s and the client's
    // refresh flow mints a token carrying the new role - no forced re-login needed.
    await this.redis.set(CacheKeys.tokenVersion(userId), updated.tokenVersion, CacheTtl.SESSION);

    this.logger.log(
      `${shouldHaveRole ? 'granted' : 'revoked'} VENDOR role for identity ${userId} (vendor ${status})`,
    );
  }
}
