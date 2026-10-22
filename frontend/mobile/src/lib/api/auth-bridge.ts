import type { TokenPair } from '@/features/auth/types';

/**
 * Indirection between the fetch client and the auth store, same as the web's
 * lib/api/auth-bridge: the client must not import React state, so the auth
 * feature registers these callbacks once at startup.
 */
interface AuthBridge {
  getAccessToken: () => string | null;
  /** Fresh pair from /auth/refresh - persist the rotated refresh token. */
  onRefreshed: (tokens: TokenPair) => Promise<void>;
  onRefreshFailed: () => void;
}

let bridge: AuthBridge | null = null;

export function registerAuthBridge(next: AuthBridge): void {
  bridge = next;
}

export function getAccessToken(): string | null {
  return bridge?.getAccessToken() ?? null;
}

export function notifyRefreshed(tokens: TokenPair): Promise<void> {
  return bridge?.onRefreshed(tokens) ?? Promise.resolve();
}

export function notifyRefreshFailed(): void {
  bridge?.onRefreshFailed();
}
