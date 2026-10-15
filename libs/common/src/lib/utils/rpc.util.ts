import { HttpStatus, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { Observable, TimeoutError, catchError, firstValueFrom, timeout } from 'rxjs';
import { AppException, ErrorCode } from '../errors/app-exception';

interface SerialisedAppError {
  __appError: true;
  code: ErrorCode;
  message: string;
  status: number;
  details?: unknown;
  retryAfterSeconds?: number;
}

function isSerialisedAppError(value: unknown): value is SerialisedAppError {
  return typeof value === 'object' && value !== null && '__appError' in value;
}

const logger = new Logger('Rpc');

/**
 * Calls a downstream service and unwraps the reply.
 *
 * Three jobs:
 *  - Rebuild the original `AppException` from the wire format, so a downstream 404 stays
 *    a 404 at the edge instead of collapsing into a 500.
 *  - Enforce a client-side deadline. A downstream service that hangs would otherwise
 *    hold a gateway worker open until the load balancer gives up.
 *  - Translate a dead connection into a 503, which clients know to retry.
 */
export async function rpc<TResult, TPayload = unknown>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
  options: { timeoutMs?: number; service?: string } = {},
): Promise<TResult> {
  const { timeoutMs = 10_000, service = 'downstream service' } = options;

  const source$ = (client.send<TResult, TPayload>(pattern, payload) as Observable<TResult>).pipe(
    timeout(timeoutMs),
    catchError((error: unknown) => {
      if (isSerialisedAppError(error)) {
        throw new AppException(error.code, error.message, error.status as HttpStatus, {
          details: error.details,
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }

      if (error instanceof TimeoutError) {
        logger.error(`${pattern} timed out after ${timeoutMs}ms`);
        throw AppException.unavailable(`${service} did not respond in time`);
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${pattern} failed: ${message}`);
      throw AppException.unavailable(`${service} is temporarily unavailable`);
    }),
  );

  return firstValueFrom(source$);
}

/**
 * Fire-and-forget notification to a service. Errors are logged, never propagated - the
 * caller's own operation already succeeded and must not be failed by a side effect.
 */
export function rpcEmit<TPayload>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
): void {
  client.emit(pattern, payload).subscribe({
    error: (error: unknown) =>
      logger.warn(`emit ${pattern} failed: ${error instanceof Error ? error.message : error}`),
  });
}
