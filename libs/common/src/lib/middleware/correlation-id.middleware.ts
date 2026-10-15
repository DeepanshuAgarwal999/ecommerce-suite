import { Injectable, NestMiddleware } from '@nestjs/common';
import { Headers } from '@ecommerce/contracts';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a correlation id at the edge and echoes it back.
 *
 * The gateway forwards this header on every downstream call, and services copy it into
 * the events they publish, so one id follows a single user action through HTTP, RPC and
 * Kafka. When a customer reports a failed order, this is what makes the logs findable.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Trust an inbound id so a mobile client can correlate its own retry attempts,
    // but bound the length - it ends up in log lines and Kafka headers.
    const inbound = req.headers[Headers.CORRELATION_ID];
    const correlationId =
      typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128
        ? inbound
        : randomUUID();

    req.headers[Headers.CORRELATION_ID] = correlationId;
    res.setHeader(Headers.CORRELATION_ID, correlationId);
    next();
  }
}
