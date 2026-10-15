import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Headers } from '@ecommerce/contracts';
import type { Request, Response } from 'express';
import { AppException, ErrorCode } from '../errors/app-exception';
import { MicroserviceExceptionFilter } from './rpc-exception.filter';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
  path: string;
  timestamp: string;
}

/**
 * Turns every thrown value into one response shape.
 *
 * Two things matter here. First, clients get a consistent envelope with a stable code.
 * Second, internal detail never leaks: a Prisma constraint name or a stack trace is
 * logged server-side and replaced with a generic message in the response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly rpcFilter = new MicroserviceExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): unknown {
    // The domain services serve both HTTP (health probes) and TCP RPC out of one app,
    // so one global filter has to answer in whichever shape the caller expects.
    if (host.getType() !== 'http') return this.rpcFilter.catch(exception, host);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers[Headers.CORRELATION_ID] as string | undefined;

    const { status, body, retryAfter } = this.normalise(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} [${correlationId ?? '-'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${body.error.code} [${correlationId ?? '-'}]`,
      );
    }

    if (retryAfter) response.setHeader('Retry-After', String(retryAfter));

    response.status(status).json({
      ...body,
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
    return undefined;
  }

  private normalise(exception: unknown): {
    status: number;
    body: Omit<ErrorResponseBody, 'correlationId' | 'path' | 'timestamp'>;
    retryAfter?: number;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
        },
        retryAfter: exception.retryAfterSeconds,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // class-validator failures arrive as { message: string[] }.
      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        const messages = record['message'];
        if (Array.isArray(messages)) {
          return {
            status,
            body: {
              success: false,
              error: {
                code: ErrorCode.VALIDATION_FAILED,
                message: 'Request validation failed',
                details: messages,
              },
            },
          };
        }
        return {
          status,
          body: {
            success: false,
            error: {
              code: (record['code'] as string) ?? this.codeForStatus(status),
              message: (record['message'] as string) ?? exception.message,
              details: record['details'],
            },
          },
        };
      }

      return {
        status,
        body: {
          success: false,
          error: { code: this.codeForStatus(status), message: String(payload) },
        },
      };
    }

    // Anything unrecognised is a bug. Never surface its message to the caller.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Something went wrong. Please try again.',
        },
      },
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
