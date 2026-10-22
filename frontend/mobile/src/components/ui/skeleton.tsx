import { memo, useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/theme-provider';
import { radius as radii } from '@/theme/tokens';

/**
 * One pulse shared by every skeleton on screen, so a page of placeholders breathes
 * in sync (like Blinkit/Zepto) instead of each block drifting on its own clock -
 * and it is one animation for the UI thread, not fifty.
 */
const pulse = makeMutable(0);
let mounted = 0;

function startPulse() {
  if (mounted++ === 0) {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }
}

function stopPulse() {
  if (--mounted === 0) {
    cancelAnimation(pulse);
    pulse.value = 0;
  }
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton = memo(function Skeleton({ width = '100%', height = 14, radius = radii.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const base = colors.skeleton;
  const shine = colors.skeletonHighlight;

  useEffect(() => {
    startPulse();
    return stopPulse;
  }, []);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pulse.value, [0, 1], [base, shine]),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, animated, style]}
    />
  );
});
