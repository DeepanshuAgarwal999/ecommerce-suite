import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaAdminService } from './kafka-admin.service';
import { KAFKA_OPTIONS, KafkaModuleOptions } from './kafka.constants';

/**
 * Ensures topics exist before any consumer subscribes.
 *
 * Runs in `onModuleInit`, which Nest completes for every module before it fires
 * `onApplicationBootstrap` - where the consumers subscribe. Ordering matters because the
 * broker has auto-creation disabled: a consumer subscribing to a missing topic would
 * sit in a retry loop instead of failing loudly.
 *
 * Guarded by `KAFKA_AUTO_CREATE_TOPICS` so a shared staging cluster is not reconfigured
 * by every deploy; in production this is a one-time ops step (`npm run kafka:topics`).
 */
@Injectable()
export class KafkaTopicInitializer implements OnModuleInit {
  private readonly logger = new Logger(KafkaTopicInitializer.name);

  constructor(
    private readonly admin: KafkaAdminService,
    @Inject(KAFKA_OPTIONS) private readonly options: KafkaModuleOptions,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config?.get<boolean>('kafka.autoCreateTopics', true) ?? true;
    if (!enabled) return;

    try {
      await this.admin.ensureTopics();
    } catch (error) {
      // Not fatal: a broker that is still coming up will be reached by the producer's
      // own retry; and if topics genuinely cannot be created, the consumers' errors
      // will say so with more context than this can.
      this.logger.warn(
        `could not verify topics on ${this.options.brokers.join(',')}: ${(error as Error).message}`,
      );
    }
  }
}
