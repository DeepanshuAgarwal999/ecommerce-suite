import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { storage } from './storage';

const DEVICE_KEY = 'device.install-id';

/**
 * A random per-install id. Doubles as the gateway's `X-Device-Id` (session list,
 * rate-limit attribution) and the recommender's visitor id for signed-out
 * browsing - the web's lib/visitor equivalent. Not a hardware identifier, so it
 * needs no tracking consent and resets on reinstall.
 */
function loadInstallId(): string {
  let id = storage.getString(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    storage.set(DEVICE_KEY, id);
  }
  return id;
}

export const installId = loadInstallId();

export const appVersion = Application.nativeApplicationVersion ?? '1.0.0';

/** `X-Client` values the gateway's ClientContextMiddleware understands. */
const CLIENT = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB';

/**
 * Identifies the app to the gateway. `X-Client: ANDROID|IOS` is what makes the
 * auth routes return the refresh token in the body (AuthCookieService) instead of
 * a browser cookie, and `X-App-Version` drives the 426 force-update gate.
 */
export const clientHeaders: Record<string, string> = {
  'x-client': CLIENT,
  'x-platform': Platform.OS,
  'x-app-version': appVersion,
  'x-device-id': installId,
  'x-visitor-id': installId,
};

export const isNativeClient = CLIENT !== 'WEB';
