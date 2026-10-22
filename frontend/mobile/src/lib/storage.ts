import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * Fast synchronous key-value storage for non-secret, persisted UI state: the cart,
 * the delivery location, recent searches. Synchronous reads mean persisted stores
 * hydrate before the first frame, so the cart badge never flickers from 0.
 *
 * Secrets (the refresh token) never go here - see lib/secure-token, which uses the
 * Keychain / Keystore.
 */
export const storage = createMMKV({ id: 'nestora.app' });

/** Zustand `persist` adapter backed by MMKV. */
export const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};
