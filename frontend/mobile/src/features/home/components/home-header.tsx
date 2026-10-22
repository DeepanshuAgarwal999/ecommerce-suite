import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, MapPin, Search, UserRound } from 'lucide-react-native';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useLocationStore } from '@/features/location/store';
import { AnimatedPlaceholder } from '@/features/search/components/animated-placeholder';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

/** Height of the part that scrolls away (location row). */
export const HEADER_COLLAPSE = 58;
/** Height of the part that stays pinned (search). */
export const HEADER_PINNED = 62;

interface HomeHeaderProps {
  scrollY: SharedValue<number>;
}

/**
 * Quick-commerce header: brand gradient behind the status bar, a delivery line
 * that slides away as you scroll, and a search pill that pins to the top.
 * Driven entirely by the scroll shared value, so collapsing never touches React
 * state and runs at the display's refresh rate.
 */
export const HomeHeader = memo(function HomeHeader({ scrollY }: HomeHeaderProps) {
  const { colors, occasion } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const location = useLocationStore((state) => state.location);

  const container = useAnimatedStyle(() => ({
    transform: [
      { translateY: -interpolate(scrollY.value, [0, HEADER_COLLAPSE], [0, HEADER_COLLAPSE], Extrapolation.CLAMP) },
    ],
  }));

  const topRow = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HEADER_COLLAPSE * 0.7], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, HEADER_COLLAPSE], [1, 0.94], Extrapolation.CLAMP) }],
  }));

  const shadow = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(scrollY.value, [0, HEADER_COLLAPSE], [0, 0.18], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.value, [0, HEADER_COLLAPSE], [0, 6], Extrapolation.CLAMP),
  }));

  const gradient = occasion
    ? ([colors.festive, colors.primary] as const)
    : ([colors.brandDark, colors.primary] as const);

  return (
    <>
    <Animated.View style={[styles.root, { paddingTop: insets.top }, container, shadow]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.topRow, topRow]}>
        <PressableScale
          style={styles.location}
          onPress={() => router.push('/location')}
          activeScale={0.98}
          accessibilityLabel={location ? `Delivering to ${location.label}, change` : 'Choose delivery location'}
        >
          <Text variant="micro" style={styles.eyebrow}>
            {location ? 'DELIVERING TO' : 'WELCOME TO NESTORA'}
          </Text>
          <View style={styles.locationLine}>
            <MapPin size={15} color="#fff" strokeWidth={2.4} />
            <Text variant="subheading" numberOfLines={1} style={styles.locationText}>
              {location ? `${location.label || location.city || ''} ${location.pincode}`.trim() : 'Set delivery location'}
            </Text>
            <ChevronDown size={16} color="#fff" strokeWidth={2.6} />
          </View>
        </PressableScale>

        <NotificationBell />
        <PressableScale
          style={styles.avatar}
          onPress={() => router.push('/account')}
          activeScale={0.9}
          accessibilityLabel="Account"
        >
          <UserRound size={20} color={colors.primary} strokeWidth={2.4} />
        </PressableScale>
      </Animated.View>

      <View style={styles.searchRow}>
        <PressableScale
          style={[styles.search, { backgroundColor: colors.card }]}
          onPress={() => router.push('/search')}
          activeScale={0.98}
          accessibilityRole="search"
        >
          <Search size={18} color={colors.primary} strokeWidth={2.6} />
          <AnimatedPlaceholder />
        </PressableScale>
      </View>
    </Animated.View>
    {/* Fixed status-bar cover: the header slides up beneath it, so the pinned
        search row stops exactly under the status bar instead of behind it. */}
    <View style={[styles.statusCover, { height: insets.top, backgroundColor: gradient[0] }]} />
    </>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, pointerEvents: 'none' },
  topRow: {
    height: HEADER_COLLAPSE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    gap: 12,
  },
  location: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { color: '#fff', flexShrink: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { height: HEADER_PINNED, paddingHorizontal: GUTTER, justifyContent: 'center', paddingBottom: 6 },
  search: {
    height: 46,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
});
