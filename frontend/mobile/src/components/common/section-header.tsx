import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string | null;
  onSeeAll?: () => void;
  /** Festive sections get the occasion colour on the title. */
  festive?: boolean;
}

export const SectionHeader = memo(function SectionHeader({ title, subtitle, onSeeAll, festive }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="heading" style={festive ? { color: colors.festive } : undefined} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="mutedForeground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <PressableScale onPress={onSeeAll} hitSlop={10} style={styles.seeAll} accessibilityLabel={`See all ${title}`}>
          <Text variant="captionStrong" tone="primary">
            See all
          </Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.6} />
        </PressableScale>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    marginBottom: 12,
    gap: 12,
  },
  copy: { flex: 1, gap: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
});
