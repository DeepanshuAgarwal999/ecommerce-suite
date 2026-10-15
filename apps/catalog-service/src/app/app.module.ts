import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { BrandService } from './brand/brand.service';
import { CatalogController } from './catalog.controller';
import { CategoryService } from './category/category.service';
import { CatalogConsumer } from './consumers/catalog.consumer';
import { BannerService } from './merchandising/banner.service';
import { FooterService } from './merchandising/footer.service';
import { HomeSectionService } from './merchandising/home-section.service';
import { MerchandisingController } from './merchandising/merchandising.controller';
import { ThemeService } from './merchandising/theme.service';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { ProductService } from './product/product.service';
import { ReviewService } from './review/review.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.CATALOG),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.CATALOG),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [CatalogController, MerchandisingController],
  providers: [
    CategoryService,
    BrandService,
    ProductService,
    ReviewService,
    BannerService,
    ThemeService,
    HomeSectionService,
    FooterService,
    CatalogConsumer,
    OutboxProcessor,
  ],
})
export class AppModule {}
