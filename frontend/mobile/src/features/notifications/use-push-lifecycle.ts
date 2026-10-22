import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store';
import { queryKeys } from '@/lib/api';
import { notificationKeys } from './api';
import { configureForegroundPresentation, ensureChannels, registerForPush, routeForNotification } from './push';

configureForegroundPresentation();

/**
 * Mounted once in the root navigator. Owns everything push-related that isn't
 * a screen:
 *  - registers the device whenever a user is signed in (and again when the FCM
 *    token rotates, or when they return from Settings having enabled push);
 *  - refreshes the inbox badge and any open order screen the moment a push lands,
 *    so "Shipped" appears without a pull-to-refresh;
 *  - routes notification taps, including the tap that cold-started the app.
 */
export function usePushLifecycle(): void {
  const router = useRouter();
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const handledColdStart = useRef(false);

  // Channels exist from first launch so the OS settings screen lists them.
  useEffect(() => {
    void ensureChannels().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void registerForPush(userId);

    const tokenSub = Notifications.addPushTokenListener((token) => {
      void registerForPush(userId, typeof token.data === 'string' ? token.data : undefined);
    });
    const appSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void registerForPush(userId);
    });
    return () => {
      tokenSub.remove();
      appSub.remove();
    };
  }, [userId]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      void client.invalidateQueries({ queryKey: notificationKeys.all });
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (typeof data?.['orderId'] === 'string') {
        void client.invalidateQueries({ queryKey: queryKeys.orders.all });
      }
    });

    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      void client.invalidateQueries({ queryKey: notificationKeys.all });
      router.push(routeForNotification(data));
    };

    // The tap that launched the app from a killed state.
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      const last = Notifications.getLastNotificationResponse();
      if (last) {
        open(last);
        Notifications.clearLastNotificationResponse();
      }
    }

    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [client, router]);
}
