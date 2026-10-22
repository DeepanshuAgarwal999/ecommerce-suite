import { API_URL } from '@/config/env';
import type { TokenPair } from '@/features/auth/types';
import { clientHeaders } from '@/lib/device';
import { secureToken } from '@/lib/secure-token';
import { getAccessToken, notifyRefreshFailed, notifyRefreshed } from './auth-bridge';
import { ApiError, isApiError, NetworkError } from './errors';

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON unless it is already a FormData or string body. */
  body?: unknown;
  searchParams?: Record<string, QueryValue | QueryValue[]>;
  /** Skip the bearer header and the 401 refresh retry (the auth endpoints). */
  anonymous?: boolean;
  /** Abort after this many ms. Mobile networks stall rather than fail. */
  timeoutMs?: number;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** Listeners for app-wide conditions the client detects (force update). */
type UpgradeListener = (minimumVersion: string | undefined) => void;
const upgradeListeners = new Set<UpgradeListener>();

export function onUpgradeRequired(listener: UpgradeListener): () => void {
  upgradeListeners.add(listener);
  return () => upgradeListeners.delete(listener);
}

function buildUrl(path: string, searchParams?: RequestOptions['searchParams']): string {
  const query: string[] = [];
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue;
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  const url = `${API_URL}/${path.replace(/^\/+/, '')}`;
  return query.length > 0 ? `${url}?${query.join('&')}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed';
  let code = 'UNKNOWN';
  let details: unknown;

  try {
    const payload = (await response.json()) as Partial<ErrorEnvelope> & Record<string, unknown>;
    if (payload?.error && typeof payload.error === 'object') {
      message = payload.error.message ?? message;
      code = payload.error.code ?? code;
      details = payload.error.details;
    } else if (typeof payload?.message === 'string') {
      message = payload.message;
    }
  } catch {
    // Proxy errors return HTML, not JSON. Keep statusText.
  }

  return new ApiError(response.status, message, code, details);
}

/**
 * Rotates the session using the refresh token from secure storage. One flight at
 * a time: parallel 401s await the same promise, because the gateway rotates the
 * refresh token on every use and a second concurrent call would present a token
 * the first one just invalidated.
 *
 * Only a definite rejection (401/403) ends the session. A timeout or no signal
 * keeps the stored token so the shopper is still signed in once back online.
 */
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await secureToken.getRefreshToken();
      if (!refreshToken) {
        notifyRefreshFailed();
        return false;
      }
      const tokens = await apiFetch<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        anonymous: true,
      });
      await notifyRefreshed(tokens);
      return true;
    } catch (error) {
      if (isApiError(error) && error.isAuthError) {
        await secureToken.clear();
        notifyRefreshFailed();
      }
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

/**
 * Thin fetch wrapper around the NestJS api-gateway: client identity headers,
 * bearer token, envelope unwrapping, typed errors, a timeout, and one retry
 * through a token refresh on 401.
 */
export async function apiFetch<T>(
  path: string,
  { body, searchParams, headers, anonymous, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init }: RequestOptions = {},
  retried = false,
): Promise<T> {
  const isPlainBody = body instanceof FormData || typeof body === 'string';
  const token = anonymous ? null : getAccessToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, searchParams), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...clientHeaders,
        ...(body !== undefined && !isPlainBody ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isPlainBody ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error; // the caller cancelled - React Query expects the abort
    const timedOut = controller.signal.aborted;
    throw new NetworkError(timedOut ? 'Request timed out' : 'Network request failed', timedOut);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  if (response.status === 401 && !anonymous && !retried) {
    if (await refreshSession()) {
      return apiFetch<T>(path, { body, searchParams, headers, anonymous, timeoutMs, signal, ...init }, true);
    }
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 426) {
      const minimum = (error.details as { minimumVersion?: string } | undefined)?.minimumVersion;
      upgradeListeners.forEach((listener) => listener(minimum));
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as SuccessEnvelope<T> | T;
  return payload && typeof payload === 'object' && 'success' in payload && 'data' in payload
    ? (payload as SuccessEnvelope<T>).data
    : (payload as T);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
