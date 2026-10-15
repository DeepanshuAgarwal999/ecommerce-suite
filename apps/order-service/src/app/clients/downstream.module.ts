import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@ecommerce/contracts';

/**
 * Synchronous clients used while an order is being placed.
 *
 * Order creation needs the priced cart and the frozen address *now* - the customer is on
 * the confirmation screen - so these two reads are RPC. Everything after creation is
 * event-driven.
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ServiceTokens.CART,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('services.cart.host', 'localhost'),
            port: config.get<number>('services.cart.port', 4005),
          },
        }),
      },
      {
        name: ServiceTokens.USER,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('services.user.host', 'localhost'),
            port: config.get<number>('services.user.port', 4002),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class DownstreamModule {}
