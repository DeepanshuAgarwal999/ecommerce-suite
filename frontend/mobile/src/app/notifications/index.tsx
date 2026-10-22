import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellOff, CreditCard, Gift, Package, Settings, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useInbox, useMarkAllRead, useMarkRead, type InboxItem, type NotificationCategory } from '@/features/notifications/api';
import { PushOptInCard } from '@/features/notifications/components/push-opt-in';
import { routeForNotification } from '@/features/notifications/push';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  ORDER: Package,
  TRANSACTIONAL: Package,
  PAYMENT: CreditCard,
  PROMOTIONAL: Gift,
  ACCOUNT: ShieldCheck,
  SYSTEM: ShieldCheck,
};

/** "2m", "3h", "Yesterday", "12 Oct" - inbox-style relative time. */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return 'Yesterday';
  const date = new Date(iso);
  return `${date.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]}`;
}

/**
 * The inbox: the durable record of every notification (push is only the
 * wake-up), so a shopper who denied push still sees their order updates here.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inbox = useInbox();
  const markAll = useMarkAllRead();
  const items = useMemo(() => inbox.data?.pages.flatMap((page) => page.items) ?? [], [inbox.data]);
  const hasUnread = items.some((item) => !item.readAt);

  const renderItem = useCallback<ListRenderItem<InboxItem>>(({ item }) => <InboxRow item={item} />, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Notifications"
        right={
          <View style={styles.headerActions}>
            {hasUnread ? (
              <PressableScale onPress={() => markAll.mutate()} hitSlop={8} disabled={markAll.isPending}>
                <Text variant="captionStrong" tone="primary">
                  Mark all read
                </Text>
              </PressableScale>
            ) : null}
            <PressableScale onPress={() => router.push('/notifications/settings')} hitSlop={8} activeScale={0.85} accessibilityLabel="Notification settings">
              <Settings size={20} color={colors.foreground} />
            </PressableScale>
          </View>
        }
      />
      {inbox.isLoading ? (
        <View style={styles.skeleton}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={72} radius={14} />
          ))}
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={styles.optIn}>
              <PushOptInCard reason="Order and payment updates arrive instantly instead of waiting here." />
            </View>
          }
          onEndReached={() => inbox.hasNextPage && !inbox.isFetchingNextPage && void inbox.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={inbox.isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : null}
          refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyState icon={<BellOff size={36} color={colors.primary} />} title="No notifications yet" description="Order updates and offers will show up here." />
          }
        />
      )}
    </View>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const { colors } = useTheme();
  const router = useRouter();
  const markRead = useMarkRead();
  const Icon = CATEGORY_ICON[item.category] ?? Package;
  const unread = !item.readAt;

  // Seen on screen counts as read after a moment, like most inboxes.
  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => markRead.mutate([item.id]), 2500);
    return () => clearTimeout(id);
  }, [unread, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PressableScale
      onPress={() => {
        if (unread) markRead.mutate([item.id]);
        router.push(routeForNotification({ ...(item.data ?? {}), deepLink: item.deepLink ?? undefined }));
      }}
      activeScale={0.99}
      style={[styles.row, { borderBottomColor: colors.border, backgroundColor: unread ? colors.secondary : 'transparent' }]}
    >
      <View style={[styles.icon, { backgroundColor: unread ? colors.card : colors.muted }]}>
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </Text>
          <Text variant="micro" tone="mutedForeground">
            {ago(item.createdAt)}
          </Text>
        </View>
        <Text variant="caption" tone="mutedForeground" numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      {item.imageUrl ? <Image source={item.imageUrl} style={styles.image} contentFit="cover" /> : null}
      {unread ? <View style={[styles.dot, { backgroundColor: colors.highlight }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 6 },
  skeleton: { padding: GUTTER, gap: 10 },
  optIn: { padding: GUTTER, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  image: { width: 48, height: 48, borderRadius: radius.sm },
  dot: { position: 'absolute', left: 6, top: '50%', width: 6, height: 6, borderRadius: 3 },
});
