import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ClientInfo, Headers } from '@ecommerce/contracts';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Never log these, in any shape. */
const REDACTED_FIELDS = new Set([
  'password',
  'mpin',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'razorpay_signature',
  'keySecret',
  'privateKey',
]);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (acc, [key, entry]) => {
      acc[key] = REDACTED_FIELDS.has(key) ? '[redacted]' : redact(entry, depth + 1);
      return acc;
    },
    {},
  );
}

/**
 * Access log with duration. The correlation id ties this line to the same request in
 * every downstream service, which is what makes a distributed trace readable without a
 * full tracing backend.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request & { client?: ClientInfo }>();
    const response = context.switchToHttp().getResponse<Response>();
    const correlationId = request.headers[Headers.CORRELATION_ID] as string | undefined;
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, startedAt, correlationId),
        error: (error) =>
          this.write(request, error?.status ?? 500, startedAt, correlationId, error?.message),
      }),
    );
  }

  private write(
    request: Request & { client?: ClientInfo },
    status: number,
    startedAt: bigint,
    correlationId?: string,
    error?: string,
  ): void {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    // `src` and `app` make it possible to slice latency and error rate per client
    // (Android vs iOS vs web) straight from the access log.
    const source = request.client?.source ?? '-';
    const appVersion = request.client?.appVersion ?? '-';
    const line =
      `${request.method} ${request.originalUrl} ${status} ${durationMs.toFixed(1)}ms ` +
      `src=${source} app=${appVersion} v${request.client?.apiVersion ?? '?'} ` +
      `cid=${correlationId ?? '-'}${error ? ` err="${error}"` : ''}`;

    if (status >= 500) this.logger.error(line);
    else if (status >= 400) this.logger.warn(line);
    else this.logger.log(line);
  }
}
