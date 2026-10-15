import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

/**
 * Caps how long any single request may occupy a worker.
 *
 * Without a server-side deadline, one slow dependency parks request handlers until the
 * event loop is saturated and healthy endpoints start failing too. Cutting the request
 * loose keeps the failure contained to the callers who actually hit the slow path.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = config.get<number>('observability.requestTimeoutMs', 15_000);
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new RequestTimeoutException('The request took too long and was cancelled')
            : error,
        ),
      ),
    );
  }
}
