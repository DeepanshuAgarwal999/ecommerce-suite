import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@ecommerce/contracts';

/**
 * payment-service reads the order it is about to charge for over RPC, because the
 * amount must come from the order record - never from the client - and the customer is
 * waiting on the checkout screen.
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ServiceTokens.ORDER,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('services.order.host', 'localhost'),
            port: config.get<number>('services.order.port', 4006),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class DownstreamModule {}
