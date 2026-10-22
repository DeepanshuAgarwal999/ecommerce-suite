import { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';
import type { ProductSort } from '../types';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export const SortChips = memo(function SortChips({ value, onChange }: { value: ProductSort; onChange: (sort: ProductSort) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SORT_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            activeScale={0.94}
            onPress={() => {
              haptic.selection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card },
            ]}
          >
            <Text variant="captionStrong" style={{ color: selected ? colors.primary : colors.foreground }}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: GUTTER, gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
});
