import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, LifeBuoy } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CATEGORY_LABELS, TICKET_STATUS_META, useMyTickets, type TicketSummary } from '@/features/support/api';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

export default function TicketsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tickets = useMyTickets();
  const items = useMemo(() => tickets.data?.pages.flatMap((page) => page.items) ?? [], [tickets.data]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="My support tickets" />
      {tickets.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={84} radius={16} />
          ))}
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(ticket) => ticket.id}
          renderItem={({ item }) => <TicketRow ticket={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: GUTTER, paddingBottom: insets.bottom + 24 }}
          onEndReached={() => tickets.hasNextPage && !tickets.isFetchingNextPage && void tickets.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={tickets.isRefetching} onRefresh={() => void tickets.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={<LifeBuoy size={36} color={colors.primary} />}
              title="No tickets"
              description="Questions about an order? Our assistant answers instantly and loops in the team when needed."
              actionLabel="Chat with us"
              onAction={() => router.push('/support')}
            />
          }
        />
      )}
    </View>
  );
}

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const { colors } = useTheme();
  const router = useRouter();
  const meta = TICKET_STATUS_META[ticket.status];
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/support/[id]', params: { id: ticket.id } })}
      activeScale={0.98}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <Text variant="micro" tone="mutedForeground">
            {ticket.ticketNumber} · {CATEGORY_LABELS[ticket.category]}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
            <Text variant="micro" tone={meta.tone}>
              {meta.label}
            </Text>
          </View>
        </View>
        <Text variant="bodyStrong" numberOfLines={1}>
          {ticket.subject}
        </Text>
        <Text variant="caption" tone="mutedForeground">
          Updated {formatDateTime(ticket.lastActivityAt)}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.mutedForeground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: GUTTER, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
});
