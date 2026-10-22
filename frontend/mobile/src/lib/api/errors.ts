/** A non-2xx response from the api-gateway, carrying its problem details. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code = 'UNKNOWN',
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** 401/403 — the caller should send the user to login, not retry. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Retrying a 5xx or 429 can help; retrying a 400 never will. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Connectivity failure or timeout - no response reached us. */
export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(message: string, timedOut = false) {
    super(message);
    this.name = 'NetworkError';
    this.timedOut = timedOut;
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/** One line a shopper can read, for toasts and inline errors. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isNetworkError(error)) {
    return error.timedOut ? 'This is taking too long. Check your connection and retry.' : "You're offline. Check your connection.";
  }
  if (isApiError(error)) return error.message || fallback;
  return fallback;
}
