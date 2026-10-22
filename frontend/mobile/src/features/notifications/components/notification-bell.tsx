import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Bell } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useRequireAuth } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';
import { springs } from '@/theme/tokens';
import { useUnreadCount } from '../api';

/** Header bell: the badge pops and the bell rings when the unread count goes up. */
export function NotificationBell() {
  const { colors } = useTheme();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const { data: count = 0 } = useUnreadCount();
  const ring = useSharedValue(0);
  const badge = useSharedValue(count > 0 ? 1 : 0);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    // Ring only when something new arrived - not on first load, not when reading clears it.
    const grew = previous.current !== null && count > previous.current;
    previous.current = count;
    if (count === 0) {
      badge.value = withSpring(0, springs.press);
      return;
    }
    badge.value = grew ? withSequence(withSpring(1.3, springs.pop), withSpring(1, springs.pop)) : withSpring(1, springs.press);
    if (grew) {
      ring.value = withSequence(
        withTiming(-14, { duration: 80 }),
        withTiming(12, { duration: 100 }),
        withTiming(-8, { duration: 90 }),
        withTiming(0, { duration: 90 }),
      );
    }
  }, [count, badge, ring]);

  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.value}deg` }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));

  return (
    <PressableScale
      onPress={() => requireAuth(() => router.push('/notifications'))}
      activeScale={0.9}
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      style={styles.button}
    >
      <Animated.View style={bellStyle}>
        <Bell size={20} color="#fff" strokeWidth={2.4} />
      </Animated.View>
      <Animated.View style={[styles.badge, { backgroundColor: colors.promo, borderColor: colors.primary }, badgeStyle]}>
        <Text variant="micro" tabular style={{ color: colors.promoForeground, fontSize: 9 }}>
          {count > 9 ? '9+' : count}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
