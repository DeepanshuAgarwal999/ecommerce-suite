import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Bell,
  Package,
  Smartphone,
  UserRound,
  Vibrate,
  type LucideIcon,
} from 'lucide-react-native';
import { TAB_BAR_HEIGHT } from '@/components/navigation/tab-bar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { APP_VARIANT } from '@/config/env';
import { useIsSignedIn, useSignOut } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/store';
import { appVersion } from '@/lib/device';
import { haptic } from '@/lib/haptics';
import { usePreferencesStore, type Appearance } from '@/store/preferences-store';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const APPEARANCE: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function AccountScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const user = useAuthStore((state) => state.user);
  const signOut = useSignOut();
  const { appearance, haptics, setAppearance, setHaptics } = usePreferencesStore();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={[colors.brandDark, colors.primary]} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatar}>
          <UserRound size={28} color={colors.primary} />
        </View>
        {signedIn ? (
          <View style={{ gap: 2 }}>
            <Text variant="title" style={styles.light}>
              Hello!
            </Text>
            <Text variant="bodyStrong" style={styles.lightMuted}>
              {user ? `${user.countryCode} ${user.mobile}` : 'Signed in'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10, flex: 1 }}>
            <Text variant="title" style={styles.light}>
              Your account
            </Text>
            <Text variant="caption" style={styles.lightMuted}>
              Log in to track orders, save addresses and sync your wishlist.
            </Text>
            <Button label="Log in or sign up" variant="secondary" onPress={() => router.push('/login')} style={styles.loginButton} />
          </View>
        )}
      </LinearGradient>

      {signedIn ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.quick}>
          <QuickTile icon={Package} label="Orders" onPress={() => router.push('/orders')} />
          <QuickTile icon={Heart} label="Wishlist" onPress={() => router.push('/wishlist')} />
          <QuickTile icon={MapPin} label="Addresses" onPress={() => router.push('/addresses')} />
        </Animated.View>
      ) : null}

      <Group title="Help">
        <Row icon={LifeBuoy} label="Help & support" onPress={() => (signedIn ? router.push('/support') : router.push('/login'))} />
        {signedIn ? <Row icon={LifeBuoy} label="My support tickets" onPress={() => router.push('/support/tickets')} /> : null}
      </Group>

      <Group title="Appearance">
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {APPEARANCE.map((option) => {
            const selected = appearance === option.value;
            return (
              <PressableScale
                key={option.value}
                onPress={() => {
                  haptic.selection();
                  setAppearance(option.value);
                }}
                activeScale={0.95}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.segmentItem, selected && { backgroundColor: colors.card }]}
              >
                <Text variant="captionStrong" tone={selected ? 'primary' : 'mutedForeground'}>
                  {option.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Row
          icon={Vibrate}
          label="Haptic feedback"
          right={<Switch value={haptics} onValueChange={setHaptics} trackColor={{ true: colors.primary, false: colors.input }} thumbColor="#fff" />}
        />
      </Group>

      {signedIn ? (
        <Group title="Notifications">
          <Row icon={Bell} label="Inbox" onPress={() => router.push('/notifications')} />
          <Row icon={Bell} label="Notification settings" onPress={() => router.push('/notifications/settings')} />
        </Group>
      ) : null}

      {signedIn ? (
        <Group title="Security">
          <Row
            icon={LogOut}
            label="Log out"
            destructive
            onPress={() =>
              Alert.alert('Log out?', 'Your cart stays on this phone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
          />
        </Group>
      ) : null}

      <View style={styles.footer}>
        <Smartphone size={14} color={colors.mutedForeground} />
        <Text variant="micro" tone="mutedForeground">
          Nestora v{appVersion}
          {APP_VARIANT !== 'production' ? ` · ${APP_VARIANT}` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

function QuickTile({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} activeScale={0.94} style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Icon size={22} color={colors.primary} />
      <Text variant="captionStrong">{label}</Text>
    </PressableScale>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text variant="captionStrong" tone="mutedForeground" style={styles.groupTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  onPress,
  right,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <Icon size={19} color={destructive ? colors.destructive : colors.mutedForeground} />
      <Text style={{ flex: 1 }} tone={destructive ? 'destructive' : 'foreground'}>
        {label}
      </Text>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.mutedForeground} /> : null)}
    </>
  );
  return onPress ? (
    <PressableScale onPress={onPress} activeScale={0.99} style={styles.row}>
      {content}
    </PressableScale>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: GUTTER, paddingBottom: 28, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  light: { color: '#fff' },
  lightMuted: { color: 'rgba(255,255,255,0.85)' },
  loginButton: { alignSelf: 'flex-start' },
  quick: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, marginTop: -14 },
  quickTile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  group: { paddingHorizontal: GUTTER, marginTop: 22, gap: 8 },
  groupTitle: { letterSpacing: 0.8, paddingLeft: 4 },
  groupCard: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 4 },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4, marginVertical: 10 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 28 },
});
