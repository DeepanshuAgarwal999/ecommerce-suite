import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { useIsSignedIn } from '@/features/auth/session';
import { api, endpoints, errorMessage } from '@/lib/api';
import type { Paginated } from '@/types';

/** libs/contracts NotificationCategory. */
export type NotificationCategory = 'TRANSACTIONAL' | 'ORDER' | 'PAYMENT' | 'PROMOTIONAL' | 'ACCOUNT' | 'SYSTEM';

/** GET /notifications - notification-service listInbox. */
export interface InboxItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  imageUrl: string | null;
  deepLink: string | null;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

/** GET /notifications/preferences - one row per category, defaults filled in. */
export interface CategoryPreference {
  category: NotificationCategory;
  /** TRANSACTIONAL / PAYMENT / ACCOUNT can't be turned off (NON_OPTOUT_CATEGORIES). */
  locked: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
}

export interface RegisterDeviceInput {
  token: string;
  platform: 'ANDROID' | 'IOS';
  deviceId?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

export const notificationsApi = {
  registerDevice: (input: RegisterDeviceInput) => api.post<unknown>(endpoints.notifications.devices, input),
  unregisterDevice: (token: string) => api.delete<unknown>(endpoints.notifications.devices, { body: { token } }),
  inbox: (page: number) => api.get<Paginated<InboxItem>>(endpoints.notifications.inbox, { searchParams: { page, limit: 20 } }),
  unreadCount: () => api.get<{ count: number }>(endpoints.notifications.unreadCount),
  markRead: (notificationIds: string[]) => api.post<unknown>(endpoints.notifications.read, { notificationIds }),
  markAllRead: () => api.post<unknown>(endpoints.notifications.readAll, {}),
  preferences: () => api.get<CategoryPreference[]>(endpoints.notifications.preferences),
  updatePreferences: (preferences: { category: NotificationCategory; pushEnabled?: boolean; inAppEnabled?: boolean }[]) =>
    api.put<CategoryPreference[]>(endpoints.notifications.preferences, { preferences }),
};

export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: () => [...notificationKeys.all, 'inbox'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

export function useInbox() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: notificationKeys.inbox(),
    queryFn: ({ pageParam }) => notificationsApi.inbox(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    enabled: signedIn,
    staleTime: 30_000,
  });
}

/** Badge count. Refetched on app foreground (query focus manager) and when a push arrives. */
export function useUnreadCount() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: notificationsApi.unreadCount,
    enabled: signedIn,
    staleTime: 60_000,
    select: (result) => result.count,
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => toast.success('All caught up'),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function usePreferences() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: notificationKeys.preferences(), queryFn: notificationsApi.preferences, enabled: signedIn });
}

/** Optimistic toggle; the server rejects locked categories, which rolls back. */
export function useUpdatePreference() {
  const client = useQueryClient();
  const key = notificationKeys.preferences();
  return useMutation({
    mutationFn: (update: { category: NotificationCategory; pushEnabled?: boolean; inAppEnabled?: boolean }) =>
      notificationsApi.updatePreferences([update]),
    onMutate: async (update) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<CategoryPreference[]>(key);
      if (previous) {
        client.setQueryData(
          key,
          previous.map((row) => (row.category === update.category ? { ...row, ...update } : row)),
        );
      }
      return { previous };
    },
    onError: (error, _update, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast.error(errorMessage(error, 'Could not update the setting.'));
    },
    onSuccess: (rows) => client.setQueryData(key, rows),
  });
}
