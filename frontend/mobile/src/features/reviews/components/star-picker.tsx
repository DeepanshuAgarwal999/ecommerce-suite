import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { springs } from '@/theme/tokens';

export const RATING_LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Loved it!'] as const;

/** Rating colour scale used across reviews: red -> amber -> green. */
export function ratingColor(rating: number): string {
  return ['#9ca3af', '#e5484d', '#f76b15', '#f5b400', '#30a46c', '#18794e'][rating] ?? '#9ca3af';
}

interface StarPickerProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}

/**
 * Five tappable stars. Picking a rating fills stars left-to-right with a
 * staggered spring "pop", so a 5-star tap feels like a little celebration
 * and a 1-star tap stays restrained.
 */
export const StarPicker = memo(function StarPicker({ value, onChange, size = 40 }: StarPickerProps) {
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Rating"
      accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} stars, ${RATING_LABELS[value]}` : 'Not rated' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onChange(Math.max(1, Math.min(5, value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))))
      }
    >
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarButton key={star} index={star} value={value} size={size} onPress={() => onChange(star)} />
        ))}
      </View>
      <Text variant="heading" style={{ color: ratingColor(value), minHeight: 24 }}>
        {value ? RATING_LABELS[value] : 'Tap to rate'}
      </Text>
    </View>
  );
});

function StarButton({ index, value, size, onPress }: { index: number; value: number; size: number; onPress: () => void }) {
  const { colors } = useTheme();
  const filled = index <= value;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (filled) scale.value = withDelay((index - 1) * 45, withSequence(withSpring(1.28, springs.pop), withSpring(1, springs.pop)));
  }, [filled, value, index, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = filled ? ratingColor(value) : colors.input;

  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      hitSlop={6}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Animated.View style={style}>
        <Star size={size} color={color} fill={filled ? color : 'transparent'} strokeWidth={1.6} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 10 },
  stars: { flexDirection: 'row', gap: 10 },
});
