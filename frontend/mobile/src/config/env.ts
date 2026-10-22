import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppVariant = 'development' | 'staging' | 'production';

const extra = (Constants.expoConfig?.extra ?? {}) as { variant?: AppVariant; apiUrl?: string };

export const APP_VARIANT: AppVariant = extra.variant ?? 'development';
export const IS_DEV = __DEV__ || APP_VARIANT === 'development';

const GATEWAY_PORT = 3000;
const GATEWAY_PATH = '/api/v1';

/**
 * In development the gateway runs on the same machine as Metro, so its address is
 * derived from Metro's: a phone on Wi-Fi reaches it at the laptop's LAN IP
 * (`hostUri`), the Android emulator at 10.0.2.2 (its alias for the host's
 * localhost). That means no per-developer .env edit to get a build talking.
 */
function devGatewayUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${GATEWAY_PORT}${GATEWAY_PATH}`;
  }
  const loopback = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${loopback}:${GATEWAY_PORT}${GATEWAY_PATH}`;
}

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl;
  if (configured) return configured.replace(/\/+$/, '');
  if (!IS_DEV) {
    // A store build with no API URL would silently hit nothing - fail at boot instead.
    throw new Error('EXPO_PUBLIC_API_URL must be set for staging and production builds.');
  }
  return devGatewayUrl();
}

export const API_URL = resolveApiUrl();

if (!IS_DEV && !API_URL.startsWith('https://')) {
  throw new Error(`Release builds must use HTTPS. Got ${API_URL}`);
}

/** Matches lib/validations/auth on the web: the storefront is India-only for now. */
export const COUNTRY_CODE = '+91';
