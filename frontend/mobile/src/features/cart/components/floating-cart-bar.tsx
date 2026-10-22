import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius, springs } from '@/theme/tokens';
import { useCartLines, useCartTotals } from '../store';

interface FloatingCartBarProps {
  /** Distance from the bottom edge - sits on top of the tab bar. */
  bottom: number;
  hidden?: boolean;
}

/**
 * The Zepto/Blinkit "View cart" bar. Springs up from below on the first add,
 * bumps its count on every change, and shows how far the shopper is from free
 * delivery. Hidden on the cart tab itself.
 */
export const FloatingCartBar = memo(function FloatingCartBar({ bottom, hidden }: FloatingCartBarProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const lines = useCartLines();
  const totals = useCartTotals();
  const visible = totals.itemCount > 0 && !hidden;

  const translate = useSharedValue(140);
  const bump = useSharedValue(1);

  useEffect(() => {
    translate.value = withSpring(visible ? 0 : 140, springs.sheet);
  }, [visible, translate]);

  useEffect(() => {
    if (totals.itemCount > 0) bump.value = withSequence(withSpring(1.06, springs.pop), withSpring(1, springs.pop));
  }, [totals.itemCount, bump]);

  const container = useAnimatedStyle(() => ({ transform: [{ translateY: translate.value }, { scale: bump.value }] }));

  const toFree = totals.freeDeliveryRemaining;
  const thumbs = lines.slice(-3).reverse();

  return (
    <Animated.View style={[styles.wrap, { bottom }, container]} pointerEvents={visible ? 'box-none' : 'none'}>
      <PressableScale
        onPress={() => router.push('/cart')}
        activeScale={0.98}
        haptics="light"
        accessibilityLabel={`View cart, ${totals.itemCount} items, ${formatPrice(totals.totalPaise)}`}
        style={[styles.bar, { backgroundColor: colors.success }]}
      >
        <View style={styles.thumbs}>
          {thumbs.map((line, index) => (
            <View key={line.productId} style={[styles.thumb, { marginLeft: index === 0 ? 0 : -14, zIndex: 3 - index, borderColor: colors.success }]}>
              <Image source={line.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          ))}
        </View>
        <View style={styles.copy}>
          <Text variant="subheading" style={styles.light}>
            {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'} · {formatPrice(totals.totalPaise)}
          </Text>
          <Text variant="micro" style={styles.lightMuted} numberOfLines={1}>
            {toFree === null
              ? totals.deliveryKnown && totals.deliveryFeePaise === 0
                ? 'FREE delivery'
                : 'Tap to view cart'
              : toFree > 0
                ? `Add ${formatPrice(toFree)} more for FREE delivery`
                : 'Yay! FREE delivery unlocked'}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text variant="captionStrong" style={styles.light}>
            View cart
          </Text>
          <ChevronRight size={16} color="#fff" strokeWidth={2.8} />
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: GUTTER, right: GUTTER, zIndex: 20 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  thumbs: { flexDirection: 'row' },
  thumb: { width: 34, height: 34, borderRadius: 10, overflow: 'hidden', borderWidth: 2, backgroundColor: '#fff' },
  copy: { flex: 1 },
  light: { color: '#fff' },
  lightMuted: { color: 'rgba(255,255,255,0.85)' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
