import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { DownstreamModule } from './clients/downstream.module';
import { PaymentConsumer } from './consumers/payment.consumer';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PaymentController } from './payment.controller';
import { PaymentJobs } from './payment/payment.jobs';
import { PaymentService } from './payment/payment.service';
import { PrismaModule } from './prisma/prisma.module';
import { paymentProviders } from './providers/providers';
import { RefundService } from './refund/refund.service';
import { WebhookService } from './webhook/webhook.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.PAYMENT),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.PAYMENT),
    ScheduleModule.forRoot(),
    DownstreamModule,
    HealthModule,
  ],
  controllers: [PaymentController],
  providers: [
    // Gateway adapters + registry (providers/providers.ts is the one list to extend).
    ...paymentProviders,
    PaymentService,
    RefundService,
    WebhookService,
    PaymentJobs,
    PaymentConsumer,
    OutboxProcessor,
  ],
})
export class AppModule {}
