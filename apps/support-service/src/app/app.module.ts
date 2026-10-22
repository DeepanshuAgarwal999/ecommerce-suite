import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { ConversationService } from './conversations/conversation.service';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { SupportController } from './support.controller';
import { TicketService } from './tickets/ticket.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.SUPPORT),
    PrismaModule,
    RedisModule.forRootAsync(),
    // Producer only: customer notifications leave through the outbox.
    KafkaModule.forRootAsync(ServiceNames.SUPPORT),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [SupportController],
  providers: [ConversationService, TicketService, OutboxProcessor],
})
export class AppModule {}
