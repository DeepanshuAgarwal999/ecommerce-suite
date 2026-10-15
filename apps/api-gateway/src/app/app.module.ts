import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SharedAuthModule } from '@ecommerce/auth';
import {
  AppConfigModule,
  ClientContextMiddleware,
  CorrelationIdMiddleware,
  HealthModule,
} from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { RedisModule } from '@ecommerce/redis';
import { AdminController } from './admin/admin.controller';
import { InsightsAdminController } from './admin/insights-admin.controller';
import { RecommendationController } from './recommendation/recommendation.controller';
import { MerchandisingAdminController } from './admin/merchandising-admin.controller';
import { AuthCookieService } from './auth/auth-cookie.service';
import { AuthController } from './auth/auth.controller';
import { CartController } from './cart/cart.controller';
import { CatalogController } from './catalog/catalog.controller';
import { DownstreamClientsModule } from './clients/clients.module';
import { GatewayService } from './common/gateway.service';
import { GatewayRateLimitGuard } from './common/rate-limit.guard';
import { NotificationsController } from './notifications/notifications.controller';
import { OrdersController } from './orders/orders.controller';
import { PaymentsController } from './payments/payments.controller';
import { UsersController } from './users/users.controller';
import { VendorController } from './vendor/vendor.controller';

/**
 * The public edge.
 *
 * Responsibilities, in request order: correlation id -> rate limit -> authenticate
 * (JWT, no database call) -> authorise (roles/permissions from the token) -> validate
 * the body -> forward over TCP -> wrap the response. The gateway owns no data and holds
 * no state, so it scales by adding replicas behind the load balancer.
 *
 * Guard order follows module import order: `SharedAuthModule` registers the JWT and
 * roles guards first, then the rate limiter from this module. Authenticating first is
 * deliberate - it lets the limiter key on user id for signed-in traffic and on IP only
 * for anonymous traffic. JWT verification is a single HMAC, so it is not a meaningful
 * amplification vector; the per-route `@RateLimit` budgets on OTP endpoints are what
 * actually cap abuse of the public surface.
 */
@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.API_GATEWAY),
    RedisModule.forRootAsync(),
    SharedAuthModule.forRoot(true),
    DownstreamClientsModule,
    HealthModule,
  ],
  controllers: [
    AuthController,
    UsersController,
    CatalogController,
    CartController,
    OrdersController,
    PaymentsController,
    NotificationsController,
    VendorController,
    AdminController,
    MerchandisingAdminController,
    InsightsAdminController,
    RecommendationController,
  ],
  providers: [
    GatewayService,
    AuthCookieService,
    { provide: APP_GUARD, useClass: GatewayRateLimitGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Correlation id first so every later log line carries it; then client identity,
    // which stamps X-API-Version and enforces the minimum app version.
    consumer.apply(CorrelationIdMiddleware, ClientContextMiddleware).forRoutes('*');
  }
}
