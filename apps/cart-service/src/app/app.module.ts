import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { CartController } from './cart.controller';
import { CartService } from './cart/cart.service';
import { DownstreamModule } from './clients/downstream.module';
import { CartConsumer } from './consumers/cart.consumer';
import { CouponService } from './coupon/coupon.service';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { WishlistService } from './wishlist/wishlist.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.CART),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.CART),
    ScheduleModule.forRoot(),
    DownstreamModule,
    HealthModule,
  ],
  controllers: [CartController],
  providers: [CartService, CouponService, WishlistService, CartConsumer, OutboxProcessor],
})
export class AppModule {}
