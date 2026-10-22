import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'auth.refresh-token';

/**
 * The refresh token is the one long-lived credential the app holds, so it lives
 * in the Keychain (iOS) / Keystore-encrypted prefs (Android) rather than MMKV.
 * `AFTER_FIRST_UNLOCK` lets a background refresh run after a reboot-and-unlock
 * while keeping it unreadable on a locked, freshly booted device; it is
 * `THIS_DEVICE_ONLY` so it is never restored onto another phone from a backup.
 *
 * The access token is short-lived and stays in memory only (auth store).
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureToken = {
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY, OPTIONS);
    } catch {
      // A corrupted keystore entry (seen after OS restores) must not brick boot.
      await secureToken.clear();
      return null;
    }
  },

  setRefreshToken(token: string): Promise<void> {
    return SecureStore.setItemAsync(REFRESH_KEY, token, OPTIONS);
  },

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS);
    } catch {
      // Nothing stored - nothing to clear.
    }
  },
};
