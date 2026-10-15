/** A non-2xx response from the api-gateway, carrying its problem details. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'UNKNOWN', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
