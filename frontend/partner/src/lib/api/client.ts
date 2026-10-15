import { env } from '@/config/env';
import type { TokenPair } from '@/features/auth/types';
import {
  getAccessToken,
  hasAuthBridge,
  notifyRefreshFailed,
  notifyRefreshed,
} from './auth-bridge';
import { ApiError } from './errors';

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  searchParams?: Record<string, QueryValue | QueryValue[]>;
  next?: NextFetchRequestConfig;
  /** Skip the bearer header and the 401 refresh retry (the auth endpoints). */
  anonymous?: boolean;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

/**
 * Identifies this console to the gateway as the seller-facing client — drives
 * cookie-based refresh tokens, rate-limit keys and order/session attribution.
 * See ClientSource.VENDOR_WEB in libs/contracts.
 */
const CLIENT_HEADERS: Record<string, string> = {
  'x-client': 'VENDOR_WEB',
  'x-platform': 'web',
};

function buildUrl(path: string, searchParams?: RequestOptions['searchParams']): string {
  const base = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const url = new URL(`${base}/${path.replace(/^\/+/, '')}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue;
      url.searchParams.append(key, String(item));
    }
  }

  return url.toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed';
  let code = 'UNKNOWN';
  let details: unknown;

  try {
    const payload = (await response.json()) as Partial<ErrorEnvelope> &
      Record<string, unknown>;

    if (payload?.error && typeof payload.error === 'object') {
      message = payload.error.message ?? message;
      code = payload.error.code ?? code;
      details = payload.error.details;
    } else if (typeof payload?.message === 'string') {
      message = payload.message;
    }
  } catch {
    // Proxy errors and timeouts return HTML, not JSON. Keep statusText.
  }

  return new ApiError(response.status, message, code, details);
}

/** One refresh in flight at a time — parallel 401s all await the same promise. */
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!hasAuthBridge()) return Promise.resolve(false);

  refreshing ??= (async () => {
    try {
      const tokens = await apiFetch<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: {},
        anonymous: true,
      });
      notifyRefreshed(tokens);
      return true;
    } catch {
      notifyRefreshFailed();
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

/**
 * Thin fetch wrapper around the NestJS api-gateway. Works in both Server
 * Components and the browser; in the browser it attaches the in-memory bearer
 * token, sends the refresh cookie, and retries once through a refresh on 401.
 */
export async function apiFetch<T>(
  path: string,
  { body, searchParams, headers, anonymous, ...init }: RequestOptions = {},
  retried = false,
): Promise<T> {
  const onServer = typeof window === 'undefined';
  const isPlainBody = body instanceof FormData || typeof body === 'string';
  const token = anonymous || onServer ? null : getAccessToken();

  const response = await fetch(buildUrl(path, searchParams), {
    ...init,
    credentials: onServer ? 'omit' : 'include',
    headers: {
      Accept: 'application/json',
      ...CLIENT_HEADERS,
      ...(body !== undefined && !isPlainBody
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : isPlainBody
          ? (body as BodyInit)
          : JSON.stringify(body),
  });

  if (response.status === 401 && !anonymous && !onServer && !retried) {
    if (await refreshSession()) {
      return apiFetch<T>(
        path,
        { body, searchParams, headers, anonymous, ...init },
        true,
      );
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as SuccessEnvelope<T> | T;
  return payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
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
