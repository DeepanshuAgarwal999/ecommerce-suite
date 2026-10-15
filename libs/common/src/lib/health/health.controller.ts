import { Controller, Get, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@ecommerce/redis';
import { Public } from '../decorators/public.decorator';
import { RawResponse } from '../decorators/raw-response.decorator';
import { PrismaHealth } from '../prisma/prisma-health';

/**
 * Liveness and readiness.
 *
 * They answer different questions and must not be merged. Liveness means "is the
 * process wedged" - if it fails, restart me. Readiness means "can I serve traffic right
 * now" - if it fails, stop routing to me but do not restart. Wiring a database check
 * into liveness is how a brief database blip turns into every pod restarting at once.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly prisma?: PrismaHealth,
  ) {}

  @Public()
  @Get('live')
  @RawResponse()
  live() {
    return {
      status: 'ok',
      service: this.config.get<string>('serviceName'),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Public()
  @Get('ready')
  @RawResponse()
  async ready() {
    const checks: Record<string, 'up' | 'down' | 'skipped'> = {};

    checks.database = this.prisma ? ((await this.prisma.isHealthy()) ? 'up' : 'down') : 'skipped';
    checks.redis = this.redis ? ((await this.redis.ping()) ? 'up' : 'down') : 'skipped';

    const healthy = Object.values(checks).every((state) => state !== 'down');

    return {
      status: healthy ? 'ok' : 'degraded',
      service: this.config.get<string>('serviceName'),
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
