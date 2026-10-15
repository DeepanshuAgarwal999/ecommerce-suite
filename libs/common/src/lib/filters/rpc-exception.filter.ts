import { ArgumentsHost, Catch, HttpException, Logger, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { AppException, ErrorCode } from '../errors/app-exception';

/**
 * Serialises errors thrown inside a microservice so the gateway can rebuild them.
 *
 * Without this, any thrown error crosses the TCP boundary as an opaque string and every
 * failure downstream turns into a 500 at the edge - a "product not found" would look
 * identical to a database outage. Sending the code and status across keeps the original
 * meaning.
 */
@Catch()
export class MicroserviceExceptionFilter implements RpcExceptionFilter {
  private readonly logger = new Logger(MicroserviceExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    const pattern = host.switchToRpc().getContext();

    if (exception instanceof AppException) {
      return throwError(() => ({
        __appError: true,
        code: exception.code,
        message: exception.message,
        status: exception.getStatus(),
        details: exception.details,
        retryAfterSeconds: exception.retryAfterSeconds,
      }));
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      return throwError(() => ({
        __appError: true,
        code:
          typeof payload === 'object' && payload !== null && 'code' in payload
            ? (payload as { code: string }).code
            : ErrorCode.INTERNAL_ERROR,
        message: exception.message,
        status: exception.getStatus(),
        details:
          typeof payload === 'object' && payload !== null
            ? (payload as { message?: unknown }).message
            : undefined,
      }));
    }

    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    this.logger.error(
      `unhandled error in RPC handler ${String(pattern)}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return throwError(() => ({
      __appError: true,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
      status: 500,
    }));
  }
}
