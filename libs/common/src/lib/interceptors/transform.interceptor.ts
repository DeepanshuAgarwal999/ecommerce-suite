import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Headers } from '@ecommerce/contracts';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  correlationId?: string;
  timestamp: string;
}

/**
 * Wraps every successful handler return in a consistent envelope, so clients parse one
 * shape for success and one for failure. Handlers marked `@RawResponse()` opt out -
 * needed for webhook acknowledgements and anything a third party defines the shape of.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (raw || context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = request.headers[Headers.CORRELATION_ID] as string | undefined;

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        correlationId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
