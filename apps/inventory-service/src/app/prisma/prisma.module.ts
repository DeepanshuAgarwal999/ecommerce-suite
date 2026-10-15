import { Global, Module } from '@nestjs/common';
import { PrismaHealth } from '@ecommerce/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PrismaHealth,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaHealth(prisma),
    },
  ],
  exports: [PrismaService, PrismaHealth],
})
export class PrismaModule {}
