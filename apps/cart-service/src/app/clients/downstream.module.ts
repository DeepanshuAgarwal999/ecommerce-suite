import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@ecommerce/contracts';

/**
 * Synchronous clients to the services cart-service reads from.
 *
 * Pricing a basket needs live variant prices and live availability, and the customer is
 * waiting - so these are request/response calls over TCP rather than events. Events are
 * for facts that have already happened; a cart preview is a question.
 */
@Module({
  imports: [
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
      {
        name: ServiceTokens.INVENTORY,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('services.inventory.host', 'localhost'),
            port: config.get<number>('services.inventory.port', 4004),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class DownstreamModule {}
