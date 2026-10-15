import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { DownstreamModule } from './clients/downstream.module';
import { OrderConsumer } from './consumers/order.consumer';
import { OrderController } from './order.controller';
import { OrderService } from './order/order.service';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { ReturnService } from './returns/return.service';
import { CheckoutSaga } from './saga/checkout.saga';
import { SagaRecoveryJob } from './saga/saga.recovery';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.ORDER),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.ORDER),
    ScheduleModule.forRoot(),
    DownstreamModule,
    HealthModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    ReturnService,
    CheckoutSaga,
    SagaRecoveryJob,
    OrderConsumer,
    OutboxProcessor,
  ],
})
export class AppModule {}
