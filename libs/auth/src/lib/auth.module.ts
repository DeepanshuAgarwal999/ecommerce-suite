import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Token verification, shared by any service that terminates HTTP.
 *
 * In practice that is the gateway - the domain services sit behind it and are not
 * routable from outside - but keeping this a library means a service can be split out
 * and exposed directly without reimplementing auth.
 *
 * `registerGuards` wires both guards globally. Import with `false` in a service that
 * only needs to *verify* a token in one place rather than protect everything.
 */
@Module({})
export class SharedAuthModule {
  static forRoot(registerGuards = true): DynamicModule {
    return {
      module: SharedAuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt', session: false }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get<string>('jwt.accessSecret'),
            signOptions: {
              // jsonwebtoken types `expiresIn` as a literal union of ms-style strings,
              // which a runtime config value can never satisfy structurally.
              expiresIn: config.get<string>('jwt.accessTtl', '15m') as JwtSignOptions['expiresIn'],
              issuer: config.get<string>('jwt.issuer'),
              audience: config.get<string>('jwt.audience'),
            },
          }),
        }),
      ],
      providers: [
        JwtStrategy,
        ...(registerGuards
          ? [
              // Order matters: authentication populates `request.user`, then
              // authorisation reads it. Nest applies APP_GUARDs in registration order.
              { provide: APP_GUARD, useClass: JwtAuthGuard },
              { provide: APP_GUARD, useClass: RolesGuard },
            ]
          : []),
        JwtAuthGuard,
        RolesGuard,
      ],
      exports: [JwtModule, PassportModule, JwtAuthGuard, RolesGuard],
    };
  }
}
