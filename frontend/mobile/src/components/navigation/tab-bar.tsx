import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, LayoutGrid, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { FloatingCartBar } from '@/features/cart/components/floating-cart-bar';
import { useCartCount } from '@/features/cart/store';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { springs } from '@/theme/tokens';

export const TAB_BAR_HEIGHT = 60;

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  categories: { label: 'Categories', icon: LayoutGrid },
  cart: { label: 'Cart', icon: ShoppingBag },
  account: { label: 'Account', icon: UserRound },
};

/**
 * Custom bottom bar: a pill that slides under the active tab on a spring, icons
 * that lift when focused, a cart badge that pops on change. The floating cart
 * bar is mounted here so it always sits exactly on top of the tabs.
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const routes = state.routes.filter((route) => route.name in TABS);
  const tabWidth = width / routes.length;
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, routes.findIndex((route) => route.name === activeName));

  const indicator = useSharedValue(activeIndex * tabWidth);
  useEffect(() => {
    indicator.value = withSpring(activeIndex * tabWidth, springs.sheet);
  }, [activeIndex, tabWidth, indicator]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicator.value }] }));

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <>
      <FloatingCartBar bottom={TAB_BAR_HEIGHT + bottomInset + 8} hidden={activeName === 'cart'} />
      <View
        style={[
          styles.bar,
          { paddingBottom: bottomInset, height: TAB_BAR_HEIGHT + bottomInset, backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
        accessibilityRole="tablist"
      >
        <Animated.View style={[styles.indicatorTrack, { width: tabWidth }, indicatorStyle]}>
          <View style={[styles.indicator, { backgroundColor: colors.secondary }]} />
        </Animated.View>
        {routes.map((route) => {
          const focused = route.name === activeName;
          const meta = TABS[route.name]!;
          return (
            <TabButton
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              focused={focused}
              showCartBadge={route.name === 'cart'}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic.selection();
                  navigateToTab(route.key);
                }
              }}
            />
          );
        })}
      </View>
    </>
  );
}

interface TabButtonProps {
  label: string;
  icon: LucideIcon;
  focused: boolean;
  showCartBadge?: boolean;
  onPress: () => void;
}

const TabButton = memo(function TabButton({ label, icon: Icon, focused, showCartBadge, onPress }: TabButtonProps) {
  const { colors } = useTheme();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, springs.press);
  }, [focused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 2 }, { scale: 1 + lift.value * 0.08 }],
  }));

  const color = focused ? colors.primary : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.6 : 2} />
        {showCartBadge ? <CartBadge /> : null}
      </Animated.View>
      <Text variant="micro" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
});

function CartBadge() {
  const { colors } = useTheme();
  const count = useCartCount();
  const scale = useSharedValue(count > 0 ? 1 : 0);

  useEffect(() => {
    scale.value = count > 0 ? withSequence(withSpring(1.3, springs.pop), withSpring(1, springs.pop)) : withSpring(0, springs.press);
  }, [count, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: colors.highlight, borderColor: colors.card }, style]}>
      <Text variant="micro" tabular style={{ color: colors.highlightForeground, fontSize: 9 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  indicatorTrack: { position: 'absolute', top: 6, height: 44, alignItems: 'center' },
  indicator: { width: 64, height: 44, borderRadius: 14 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: TAB_BAR_HEIGHT },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
