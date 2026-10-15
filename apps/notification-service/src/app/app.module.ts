import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { NotificationConsumer } from './consumers/notification.consumer';
import { DeviceService } from './device/device.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification/notification.service';
import { PrismaModule } from './prisma/prisma.module';
import { FcmService } from './push/fcm.service';
import { SMS_PROVIDER, smsProviderFactory } from './sms/sms.provider';
import { TemplateService } from './template/template.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.NOTIFICATION),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.NOTIFICATION),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [NotificationController],
  providers: [
    TemplateService,
    DeviceService,
    FcmService,
    NotificationService,
    NotificationConsumer,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: smsProviderFactory,
    },
  ],
})
export class AppModule {}
