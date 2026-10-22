import { useEffect } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/ui/button';
import { PushOptInCard } from '@/features/notifications/components/push-opt-in';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 60;
const CONFETTI = Array.from({ length: 18 }, (_, index) => index);

/**
 * "Order placed" celebration. Back goes home, not back into a finished
 * checkout - that screen was replaced, and the hardware back is caught here.
 */
export default function OrderSuccessScreen() {
  const { id, number } = useLocalSearchParams<{ id: string; number?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();

  const badge = useSharedValue(reduce ? 1 : 0);
  const stroke = useSharedValue(reduce ? 0 : CHECK_LENGTH);

  useEffect(() => {
    haptic.success();
    if (reduce) return;
    badge.value = withSpring(1, { damping: 9, stiffness: 180 });
    stroke.value = withDelay(220, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [badge, stroke, reduce]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: stroke.value }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.hero}>
        <View style={styles.burst}>
        {!reduce ? CONFETTI.map((index) => <Confetto key={index} index={index} />) : null}
        <Animated.View style={[styles.badge, { backgroundColor: colors.success }, badgeStyle]}>
          <Svg width={64} height={64} viewBox="0 0 64 64">
            <AnimatedPath
              d="M16 33 L28 45 L49 21"
              stroke="#fff"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={CHECK_LENGTH}
              animatedProps={checkProps}
            />
          </Svg>
        </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.copy}>
          <Text variant="display" align="center">
            Order placed!
          </Text>
          {number ? (
            <Text tone="mutedForeground" align="center">
              Order #{number}
            </Text>
          ) : null}
          <Text tone="mutedForeground" align="center">
            We’ll send you updates as your order is packed and shipped.
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(650).duration(400)} style={styles.actions}>
        <PushOptInCard />
        <Button label="View order details" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id } })} fullWidth size="lg" />
        <Button label="Continue shopping" variant="ghost" onPress={() => router.replace('/')} fullWidth />
      </Animated.View>
    </View>
  );
}

/** One piece of confetti: bursts outward from the badge, falls, fades. */
function Confetto({ index }: { index: number }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);
  const palette = [colors.primary, colors.highlight, colors.promo, colors.success];
  const angle = (index / CONFETTI.length) * Math.PI * 2;
  const distance = width * (0.28 + (index % 3) * 0.06);

  useEffect(() => {
    progress.value = withDelay(180, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      // Up and out, then gravity takes over.
      { translateY: Math.sin(angle) * distance * progress.value + 120 * progress.value * progress.value },
      { rotate: `${progress.value * 540}deg` },
    ],
  }));

  return <Animated.View style={[styles.confetto, { backgroundColor: palette[index % palette.length] }, index % 2 ? styles.round : null, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: GUTTER + 4 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  // Absolute children of a centred box start at its centre - the burst origin.
  burst: { alignItems: 'center', justifyContent: 'center' },
  badge: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 8, alignItems: 'center' },
  confetto: { position: 'absolute', width: 10, height: 6, borderRadius: 2 },
  round: { width: 8, height: 8, borderRadius: 4 },
  actions: { gap: 8 },
});
