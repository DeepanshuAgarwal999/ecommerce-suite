import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { AddressService } from './address/address.service';
import { UserConsumer } from './consumers/user.consumer';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileService } from './profile/profile.service';
import { UserController } from './user.controller';
import { VendorService } from './vendor/vendor.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.USER),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.USER),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [UserController],
  providers: [ProfileService, AddressService, VendorService, UserConsumer, OutboxProcessor],
})
export class AppModule {}
