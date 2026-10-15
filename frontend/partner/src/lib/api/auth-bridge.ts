import type { TokenPair } from '@/features/auth/types';

/**
 * Indirection between the fetch client and the auth store.
 *
 * `client.ts` runs in Server Components too, so it must not import a React
 * store directly. The browser registers these callbacks once at startup (see
 * SessionRestorer); on the server they simply stay unset.
 */
interface AuthBridge {
  getAccessToken: () => string | null;
  onRefreshed: (tokens: TokenPair) => void;
  onRefreshFailed: () => void;
}

let bridge: AuthBridge | null = null;

export function registerAuthBridge(next: AuthBridge): void {
  bridge = next;
}

export function getAccessToken(): string | null {
  return bridge?.getAccessToken() ?? null;
}

export function notifyRefreshed(tokens: TokenPair): void {
  bridge?.onRefreshed(tokens);
}

export function notifyRefreshFailed(): void {
  bridge?.onRefreshFailed();
}

export function hasAuthBridge(): boolean {
  return bridge !== null;
}
