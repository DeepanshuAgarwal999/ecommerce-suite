import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useRequireAuth } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';
import { springs } from '@/theme/tokens';
import { useToggleWishlist, useWishlistIds } from './api';

interface WishlistButtonProps {
  productId: string;
  variantId?: string;
  size?: number;
}

/** Heart toggle with a pop on save. Signed-out taps open the login sheet. */
export const WishlistButton = memo(function WishlistButton({ productId, variantId, size = 18 }: WishlistButtonProps) {
  const { colors } = useTheme();
  const saved = useWishlistIds().has(productId);
  const toggle = useToggleWishlist();
  const requireAuth = useRequireAuth();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (saved) scale.value = withSequence(withSpring(1.35, springs.pop), withSpring(1, springs.pop));
  }, [saved, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <PressableScale
      activeScale={0.85}
      hitSlop={10}
      onPress={() => requireAuth(() => toggle.mutate({ productId, variantId }))}
      accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      accessibilityState={{ selected: saved }}
      style={[styles.button, { backgroundColor: colors.card }]}
    >
      <Animated.View style={animated}>
        <Heart
          size={size}
          color={saved ? colors.highlight : colors.mutedForeground}
          fill={saved ? colors.highlight : 'transparent'}
          strokeWidth={2.2}
        />
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  button: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
