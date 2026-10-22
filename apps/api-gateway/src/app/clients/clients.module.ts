import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@ecommerce/contracts';

/**
 * TCP clients to every domain service.
 *
 * The gateway is stateless: it authenticates, authorises, validates, and forwards. Every
 * one of these clients is a persistent socket pool, so the per-request cost is a
 * serialised message rather than a connection handshake.
 *
 * Scaling note: NestJS's TCP transport connects to one host:port. Behind a Kubernetes
 * Service or a Docker Compose `deploy.replicas`, that name round-robins across replicas
 * at connect time. For per-request load balancing swap this for gRPC with a client-side
 * balancer - the message patterns stay the same.
 */
const SERVICES: { token: string; key: string; defaultPort: number }[] = [
  { token: ServiceTokens.AUTH, key: 'auth', defaultPort: 4001 },
  { token: ServiceTokens.USER, key: 'user', defaultPort: 4002 },
  { token: ServiceTokens.CATALOG, key: 'catalog', defaultPort: 4003 },
  { token: ServiceTokens.INVENTORY, key: 'inventory', defaultPort: 4004 },
  { token: ServiceTokens.CART, key: 'cart', defaultPort: 4005 },
  { token: ServiceTokens.ORDER, key: 'order', defaultPort: 4006 },
  { token: ServiceTokens.PAYMENT, key: 'payment', defaultPort: 4007 },
  { token: ServiceTokens.NOTIFICATION, key: 'notification', defaultPort: 4008 },
  { token: ServiceTokens.RECOMMENDATION, key: 'recommendation', defaultPort: 4009 },
  { token: ServiceTokens.SUPPORT, key: 'support', defaultPort: 4010 },
];

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync(
      SERVICES.map(({ token, key, defaultPort }) => ({
        name: token,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>(`services.${key}.host`, 'localhost'),
            port: config.get<number>(`services.${key}.port`, defaultPort),
          },
        }),
      })),
    ),
  ],
  exports: [ClientsModule],
})
export class DownstreamClientsModule {}
