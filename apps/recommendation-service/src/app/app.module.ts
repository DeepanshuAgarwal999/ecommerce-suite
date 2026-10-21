import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames, ServiceTokens } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { FatigueService } from './engine/fatigue.service';
import { IdentityService } from './engine/identity.service';
import { IngestService } from './engine/ingest.service';
import { CatalogSyncService } from './learning/catalog-sync.service';
import { LearnConsumer } from './learning/learn.consumer';
import { ModelBuilderService } from './learning/model-builder.service';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationController } from './recommendation.controller';
import { ProductActivityService } from './serving/product-activity.service';
import { RecommendationService } from './serving/recommendation.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.RECOMMENDATION),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.RECOMMENDATION),
    ScheduleModule.forRoot(),
    HealthModule,
    // Only for the periodic product-projection backfill.
    ClientsModule.registerAsync([
      {
        name: ServiceTokens.CATALOG,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('services.catalog.host', 'localhost'),
            port: config.get<number>('services.catalog.port', 4003),
          },
        }),
      },
    ]),
  ],
  controllers: [RecommendationController],
  providers: [
    IdentityService,
    FatigueService,
    IngestService,
    RecommendationService,
    ProductActivityService,
    LearnConsumer,
    ModelBuilderService,
    CatalogSyncService,
  ],
})
export class AppModule {}
