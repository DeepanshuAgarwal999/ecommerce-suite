import { useCallback, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Package } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { STATUS_META, useOrders, type OrderSummary } from '@/features/orders/api';
import { formatDateTime, formatPrice } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const orders = useOrders();
  const items = useMemo(() => orders.data?.pages.flatMap((page) => page.items) ?? [], [orders.data]);

  const renderItem = useCallback<ListRenderItem<OrderSummary>>(({ item }) => <OrderRow order={item} />, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="My orders" />
      {orders.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={104} radius={16} />
          ))}
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(order) => order.id}
          contentContainerStyle={{ padding: GUTTER, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && void orders.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={<Package size={36} color={colors.primary} />}
              title="No orders yet"
              description="Your orders and their delivery status will show up here."
              actionLabel="Start shopping"
              onAction={() => router.navigate('/')}
            />
          }
        />
      )}
    </View>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  const { colors } = useTheme();
  const router = useRouter();
  const meta = STATUS_META[order.status];
  const extra = order.items.length - 3;

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      activeScale={0.98}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityLabel={`Order ${order.orderNumber}, ${meta.label}, ${formatPrice(order.grandTotal)}`}
    >
      <View style={styles.top}>
        <View style={[styles.status, { backgroundColor: colors.secondary }]}>
          <View style={[styles.dot, { backgroundColor: colors[meta.tone] }]} />
          <Text variant="captionStrong" tone={meta.tone}>
            {meta.label}
          </Text>
        </View>
        <Text variant="caption" tone="mutedForeground" style={{ flex: 1 }} align="right">
          {formatDateTime(order.createdAt)}
        </Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.thumbs}>
          {order.items.slice(0, 3).map((item, index) => (
            <View key={`${item.sku}-${index}`} style={[styles.thumb, { backgroundColor: colors.muted, borderColor: colors.card }]}>
              {item.imageUrl ? <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
          ))}
          {extra > 0 ? (
            <View style={[styles.thumb, styles.more, { backgroundColor: colors.secondary, borderColor: colors.card }]}>
              <Text variant="micro" tone="primary">
                +{extra}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="captionStrong" numberOfLines={1}>
            {order.items[0]?.title}
            {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}
          </Text>
          <Text variant="caption" tone="mutedForeground">
            #{order.orderNumber} · {formatPrice(order.grandTotal)}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: GUTTER, gap: 12 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbs: { flexDirection: 'row', paddingRight: 12 },
  thumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden', borderWidth: 2, marginRight: -12 },
  more: { alignItems: 'center', justifyContent: 'center' },
});
