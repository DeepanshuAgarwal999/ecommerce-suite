import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, Lock } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePreferences, useUpdatePreference, type NotificationCategory } from '@/features/notifications/api';
import { usePushPermission } from '@/features/notifications/components/push-opt-in';
import { PUSH_SUPPORTED } from '@/features/notifications/push';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const CATEGORY_COPY: Record<NotificationCategory, { title: string; detail: string }> = {
  ORDER: { title: 'Order updates', detail: 'Packed, shipped, out for delivery, delivered' },
  PAYMENT: { title: 'Payments & refunds', detail: 'Payment confirmations, failures and refunds' },
  TRANSACTIONAL: { title: 'Essential', detail: 'Security codes and receipts' },
  ACCOUNT: { title: 'Account & security', detail: 'Sign-ins and account changes' },
  PROMOTIONAL: { title: 'Offers & recommendations', detail: 'Festive sales, price drops, picks for you' },
  SYSTEM: { title: 'App updates', detail: 'Service notices and new features' },
};

/** OS permission + per-category push/in-app switches (notification-service preferences). */
export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { permission, request } = usePushPermission();
  const preferences = usePreferences();
  const update = useUpdatePreference();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Notification settings" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, styles.permission, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <BellRing size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Push notifications</Text>
            <Text variant="caption" tone="mutedForeground">
              {!PUSH_SUPPORTED
                ? `Push on ${Platform.OS === 'ios' ? 'iPhone' : 'this device'} is coming soon - everything still arrives in your inbox.`
                : permission === 'granted'
                  ? 'On for this phone'
                  : permission === 'denied'
                    ? 'Blocked in system settings'
                    : 'Off - turn on to get delivery updates instantly'}
            </Text>
          </View>
          {PUSH_SUPPORTED && permission !== 'granted' && permission !== null ? (
            <Button
              label={permission === 'denied' ? 'Settings' : 'Turn on'}
              size="sm"
              onPress={() => (permission === 'denied' ? void Linking.openSettings() : void request())}
            />
          ) : null}
        </View>

        <Text variant="captionStrong" tone="mutedForeground" style={styles.groupTitle}>
          WHAT YOU GET
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {preferences.isLoading
            ? [0, 1, 2, 3].map((index) => <Skeleton key={index} height={44} style={{ marginVertical: 8 }} />)
            : preferences.data?.map((row, index) => {
                const copy = CATEGORY_COPY[row.category];
                return (
                  <View key={row.category} style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.titleRow}>
                        <Text variant="bodyStrong">{copy.title}</Text>
                        {row.locked ? <Lock size={12} color={colors.mutedForeground} /> : null}
                      </View>
                      <Text variant="caption" tone="mutedForeground">
                        {row.locked ? `${copy.detail} · always on` : copy.detail}
                      </Text>
                    </View>
                    <Switch
                      value={row.pushEnabled}
                      disabled={row.locked}
                      onValueChange={(value) => update.mutate({ category: row.category, pushEnabled: value })}
                      trackColor={{ true: colors.primary, false: colors.input }}
                      thumbColor="#fff"
                      accessibilityLabel={`${copy.title} push notifications`}
                    />
                  </View>
                );
              })}
        </View>
        <Text variant="caption" tone="mutedForeground" style={styles.footnote}>
          Order, payment and security messages can’t be switched off - they’re how we reach you about your money and deliveries.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: GUTTER, gap: 10 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  permission: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  groupTitle: { letterSpacing: 0.8, marginTop: 12, paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footnote: { paddingHorizontal: 4 },
});
