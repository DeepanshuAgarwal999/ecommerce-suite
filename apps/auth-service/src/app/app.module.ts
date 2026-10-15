import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, HealthModule } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { KafkaModule } from '@ecommerce/kafka';
import { RedisModule } from '@ecommerce/redis';
import { AuthAdminService } from './admin/auth-admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RoleSyncConsumer } from './consumers/role-sync.consumer';
import { OtpService } from './otp/otp.service';
import { OutboxProcessor } from './outbox/outbox.processor';
import { PrismaModule } from './prisma/prisma.module';
import { SessionCleanupJob } from './session/session.cleanup';
import { TokenService } from './session/token.service';

@Module({
  imports: [
    AppConfigModule.forRoot(ServiceNames.AUTH),
    PrismaModule,
    RedisModule.forRootAsync(),
    KafkaModule.forRootAsync(ServiceNames.AUTH),
    ScheduleModule.forRoot(),
    HealthModule,
    // Signing lives here because auth-service is the only service that mints tokens;
    // everything else only verifies them, using the shared library.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        // Default issuer/audience for every signAsync call in this service. The shared
        // JwtStrategy (libs/auth) validates both on every other service, so a token
        // minted without them is accepted here but rejected everywhere else - setting
        // them once at the module level means a future signing call can't omit them
        // by accident the way TokenService originally did.
        signOptions: {
          issuer: config.get<string>('jwt.issuer'),
          audience: config.get<string>('jwt.audience'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthAdminService,
    OtpService,
    TokenService,
    OutboxProcessor,
    SessionCleanupJob,
    RoleSyncConsumer,
  ],
})
export class AppModule {}
