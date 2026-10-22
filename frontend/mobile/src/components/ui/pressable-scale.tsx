import { memo, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it sinks on press. 0.96 for cards, 0.92 for small buttons. */
  activeScale?: number;
  haptics?: 'selection' | 'light' | 'medium' | false;
}

/**
 * The press feel used everywhere (cards, tiles, buttons): a spring scale that
 * runs entirely on the UI thread, so it stays smooth while JS is busy rendering
 * the next screen.
 */
export const PressableScale = memo(function PressableScale({
  children,
  style,
  activeScale = 0.96,
  haptics = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withSpring(activeScale, springs.press);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, springs.press);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptics) haptic[haptics]();
        onPress?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
});
