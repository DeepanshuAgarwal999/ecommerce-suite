import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutUp, ZoomIn } from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { Product } from '@/features/catalog/types';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { useCartStore, useLineQuantity } from '../store';

interface AddToCartButtonProps {
  product: Product;
  size?: 'sm' | 'md';
  /** Stretch to the parent's width (product detail footer). */
  block?: boolean;
}

/**
 * The quick-commerce "ADD" button: an outlined pill that morphs into a filled
 * - qty + stepper once the item is in the cart. Subscribes only to its own line's
 * quantity, so tapping it re-renders this button and nothing else on the screen.
 * The number rolls (slide in/out) on every change so the tap feels acknowledged
 * even before the cart bar reacts.
 */
export const AddToCartButton = memo(function AddToCartButton({ product, size = 'sm', block }: AddToCartButtonProps) {
  const { colors } = useTheme();
  const quantity = useLineQuantity(product.id);
  const height = size === 'md' ? 44 : 34;
  const width = block ? undefined : size === 'md' ? 120 : 76;

  const add = useCallback(() => {
    haptic.light();
    useCartStore.getState().addItem(product);
  }, [product]);
  const increment = useCallback(() => {
    haptic.light();
    useCartStore.getState().increment(product.id);
  }, [product.id]);
  const decrement = useCallback(() => {
    haptic.selection();
    useCartStore.getState().decrement(product.id);
  }, [product.id]);

  if (!product.inStock) {
    return (
      <View style={[styles.base, { height, width, borderColor: colors.border, backgroundColor: colors.muted }, block && styles.block]}>
        <Text variant="micro" tone="mutedForeground">
          OUT OF STOCK
        </Text>
      </View>
    );
  }

  if (quantity === 0) {
    return (
      <PressableScale
        onPress={add}
        activeScale={0.9}
        accessibilityLabel={`Add ${product.name} to cart`}
        style={[
          styles.base,
          { height, width, borderColor: colors.primary, backgroundColor: colors.card },
          block && styles.block,
        ]}
      >
        <Animated.View entering={FadeIn.duration(160)} style={styles.addRow}>
          <Text variant={size === 'md' ? 'subheading' : 'captionStrong'} tone="primary" style={styles.addLabel}>
            ADD
          </Text>
          {size === 'md' ? <Plus size={16} color={colors.primary} strokeWidth={3} /> : null}
        </Animated.View>
      </PressableScale>
    );
  }

  const atMax = quantity >= product.maxPerOrder;
  const iconSize = size === 'md' ? 18 : 14;

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(16).stiffness(320)}
      style={[
        styles.base,
        styles.stepper,
        { height, width, backgroundColor: colors.primary, borderColor: colors.primary },
        block && styles.block,
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={`${product.name}, ${quantity} in cart`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => (event.nativeEvent.actionName === 'increment' ? increment() : decrement())}
    >
      <Pressable onPress={decrement} hitSlop={8} style={styles.stepButton} accessibilityLabel="Remove one">
        <Minus size={iconSize} color={colors.primaryForeground} strokeWidth={3} />
      </Pressable>
      <View style={styles.qtyWindow}>
        <Animated.View key={quantity} entering={SlideInDown.duration(180)} exiting={SlideOutUp.duration(180)}>
          <Text variant={size === 'md' ? 'subheading' : 'captionStrong'} tabular style={{ color: colors.primaryForeground }}>
            {quantity}
          </Text>
        </Animated.View>
      </View>
      <Pressable
        onPress={increment}
        disabled={atMax}
        hitSlop={8}
        style={[styles.stepButton, atMax && styles.dim]}
        accessibilityLabel="Add one more"
      >
        <Plus size={iconSize} color={colors.primaryForeground} strokeWidth={3} />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  block: { alignSelf: 'stretch', flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLabel: { letterSpacing: 0.6 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  stepButton: { height: '100%', paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  qtyWindow: { height: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', minWidth: 16 },
  dim: { opacity: 0.4 },
});
