import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { InventoryConsumer } from './consumers/inventory.consumer';
import { InventoryController } from './inventory.controller';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { ReservationService } from './reservation/reservation.service';
import { ReservationSweeper } from './reservation/reservation.sweeper';
import { StockService } from './stock/stock.service';
import { WarehouseService } from './warehouse/warehouse.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.INVENTORY),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.INVENTORY),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [InventoryController],
  providers: [
    StockService,
    WarehouseService,
    ReservationService,
    ReservationSweeper,
    InventoryConsumer,
    OutboxProcessor,
  ],
})
export class AppModule {}
