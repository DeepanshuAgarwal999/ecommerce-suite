import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable, machine-readable error codes.
 *
 * Mobile clients branch on these, not on the message text, so messages can be reworded
 * or localised without breaking an app version that is already in the wild.
 */
export enum ErrorCode {
  // generic
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  /** App build is below the enforced minimum - client must update. */
  UPGRADE_REQUIRED = 'UPGRADE_REQUIRED',
  UNSUPPORTED_API_VERSION = 'UNSUPPORTED_API_VERSION',

  // auth
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  INVALID_MOBILE = 'INVALID_MOBILE',
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED = 'OTP_ATTEMPTS_EXCEEDED',
  OTP_COOLDOWN = 'OTP_COOLDOWN',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  MPIN_NOT_SET = 'MPIN_NOT_SET',

  // catalog / inventory
  PRODUCT_UNAVAILABLE = 'PRODUCT_UNAVAILABLE',
  VARIANT_NOT_FOUND = 'VARIANT_NOT_FOUND',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  VENDOR_NOT_APPROVED = 'VENDOR_NOT_APPROVED',

  // cart / order
  CART_EMPTY = 'CART_EMPTY',
  CART_LIMIT_EXCEEDED = 'CART_LIMIT_EXCEEDED',
  PRICE_CHANGED = 'PRICE_CHANGED',
  ORDER_NOT_CANCELLABLE = 'ORDER_NOT_CANCELLABLE',
  INVALID_ORDER_TRANSITION = 'INVALID_ORDER_TRANSITION',

  // payment
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_SIGNATURE_INVALID = 'PAYMENT_SIGNATURE_INVALID',
  PAYMENT_ALREADY_CAPTURED = 'PAYMENT_ALREADY_CAPTURED',
  REFUND_NOT_ALLOWED = 'REFUND_NOT_ALLOWED',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
}

export interface AppErrorBody {
  code: ErrorCode;
  message: string;
  /** Field-level detail for validation failures, or gateway detail for payment errors. */
  details?: unknown;
  /** Present on 429 and on retryable gateway errors. */
  retryAfterSeconds?: number;
}

/**
 * Application-level exception. Carries a code alongside the HTTP status so the same
 * error can cross an RPC boundary and be rebuilt on the other side without losing
 * meaning.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    // `number` as well as HttpStatus: Nest's enum has no member for 426 Upgrade Required,
    // which the minimum-app-version check needs.
    status: HttpStatus | number = HttpStatus.BAD_REQUEST,
    options: { details?: unknown; retryAfterSeconds?: number } = {},
  ) {
    super({ code, message, details: options.details, retryAfterSeconds: options.retryAfterSeconds }, status);
    this.code = code;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  static notFound(entity: string, id?: string): AppException {
    return new AppException(
      ErrorCode.NOT_FOUND,
      id ? `${entity} ${id} was not found` : `${entity} was not found`,
      HttpStatus.NOT_FOUND,
    );
  }

  static conflict(message: string, details?: unknown): AppException {
    return new AppException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, { details });
  }

  static forbidden(message = 'You do not have access to this resource'): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthenticated(
    message = 'Authentication required',
    code = ErrorCode.UNAUTHENTICATED,
  ): AppException {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED);
  }

  static validation(message: string, details?: unknown): AppException {
    return new AppException(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST, {
      details,
    });
  }

  static rateLimited(message: string, retryAfterSeconds: number): AppException {
    return new AppException(ErrorCode.RATE_LIMITED, message, HttpStatus.TOO_MANY_REQUESTS, {
      retryAfterSeconds,
    });
  }

  static unavailable(message = 'Service temporarily unavailable'): AppException {
    return new AppException(
      ErrorCode.SERVICE_UNAVAILABLE,
      message,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
