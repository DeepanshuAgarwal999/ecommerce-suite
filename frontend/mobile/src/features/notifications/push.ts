import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { Href } from 'expo-router';
import { api, endpoints } from '@/lib/api';
import { appVersion, installId } from '@/lib/device';
import { storage } from '@/lib/storage';
import type { RegisterDeviceInput } from './api';

/**
 * Push plumbing. The backend sends through Firebase Cloud Messaging
 * (notification-service FcmService), so the token we register must be an FCM
 * registration token:
 *
 *  - Android: `getDevicePushTokenAsync()` returns the FCM token directly. Needs
 *    `google-services.json` in the build (GOOGLE_SERVICES_FILE, app.config.ts).
 *  - iOS: it returns a raw APNs token, which firebase-admin cannot address, so
 *    iOS registration is off until the backend gains an APNs sender or the app
 *    adopts the Firebase iOS SDK. `PUSH_SUPPORTED` is the single switch.
 *
 * The in-app inbox works everywhere regardless - push is only the wake-up.
 */
export const PUSH_SUPPORTED = Platform.OS === 'android';

/** Channel ids the backend targets (FcmService.buildPayload: 'transactional' | 'default'). */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('transactional', {
    name: 'Orders & payments',
    description: 'Order confirmations, delivery updates and payment alerts',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#9a0095',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Offers & updates',
    description: 'Deals, festive drops and recommendations',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

/** Foreground pushes show as a banner too - order updates matter while the app is open. */
export function configureForegroundPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function getPushPermission(): Promise<PushPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Asks only when the answer can still change - a denied prompt can't be shown
 * again, so callers send the shopper to Settings instead.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const current = await getPushPermission();
  if (current !== 'undetermined') return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

const REGISTERED_KEY = 'push.registered';
const REFRESH_MS = 7 * 86_400_000;

interface RegisteredRecord {
  token: string;
  userId: string;
  at: number;
}

function readRecord(): RegisteredRecord | null {
  try {
    const raw = storage.getString(REGISTERED_KEY);
    return raw ? (JSON.parse(raw) as RegisteredRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Registers this device's token for `userId`. Skipped when the same token was
 * registered for the same user within a week, so a cold start costs no request;
 * the weekly re-send keeps the server's lastSeen fresh so stale devices age out.
 * Never throws - push is best-effort.
 */
export async function registerForPush(userId: string, knownToken?: string): Promise<string | null> {
  if (!PUSH_SUPPORTED || !Device.isDevice) return null;
  try {
    if ((await getPushPermission()) !== 'granted') return null;
    await ensureChannels();
    const token = knownToken ?? (await Notifications.getDevicePushTokenAsync()).data;
    if (typeof token !== 'string' || !token) return null;

    const previous = readRecord();
    if (previous && previous.token === token && previous.userId === userId && Date.now() - previous.at < REFRESH_MS) {
      return token;
    }

    await api.post(endpoints.notifications.devices, {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      deviceId: installId,
      deviceModel: Device.modelName ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      appVersion,
    } satisfies RegisterDeviceInput);
    storage.set(REGISTERED_KEY, JSON.stringify({ token, userId, at: Date.now() } satisfies RegisteredRecord));
    return token;
  } catch {
    // No google-services.json in this build, Play Services missing, or offline.
    return null;
  }
}

/** Called before sign-out (while the access token still works) so the old account stops getting pushes. */
export async function unregisterFromPush(): Promise<void> {
  const record = readRecord();
  storage.remove(REGISTERED_KEY);
  if (!record) return;
  // Direct client call (not notificationsApi) keeps auth/session -> push free of an import cycle.
  await api.delete(endpoints.notifications.devices, { body: { token: record.token } }).catch(() => undefined);
}

/**
 * Where a tapped notification should land. `data.orderId` (set by the order /
 * payment consumers) wins because our order route is keyed by id; otherwise the
 * template's `app://...` deep link is mapped; anything else opens the inbox.
 */
export function routeForNotification(data: Record<string, unknown> | undefined | null): Href {
  const orderId = typeof data?.['orderId'] === 'string' ? (data['orderId'] as string) : null;
  if (orderId) return { pathname: '/orders/[id]', params: { id: orderId } };

  const deepLink = typeof data?.['deepLink'] === 'string' ? (data['deepLink'] as string) : '';
  const path = deepLink.replace(/^app:\/\//, '').split('?')[0] ?? '';
  const [first, second] = path.split('/');
  switch (first) {
    case 'home':
      return '/';
    case 'orders':
      return '/orders';
    case 'product':
    case 'p':
      return second ? { pathname: '/product/[slug]', params: { slug: second } } : '/';
    case 'category':
    case 'c':
      return second ? { pathname: '/category/[slug]', params: { slug: second } } : '/categories';
    case 'cart':
      return '/cart';
    case 'support':
      return second ? { pathname: '/support/[id]', params: { id: second } } : '/support/tickets';
    default:
      return '/notifications';
  }
}
