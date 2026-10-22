import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BadgeCheck, CreditCard, RotateCcw, Truck, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { storeDeliveryCopy, useShippingSettings } from '@/features/shipping/api';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

/** Same promises as the web's UspStrip (features/home/data.ts usps). */
const USPS: { id: string; title: string; detail: string; icon: LucideIcon }[] = [
  { id: 'returns', title: '7-day returns', detail: 'No questions', icon: RotateCcw },
  { id: 'payments', title: 'Secure payments', detail: 'UPI, cards, COD', icon: CreditCard },
  { id: 'makers', title: 'Made by makers', detail: '1,200+ studios', icon: BadgeCheck },
];

export const UspStrip = memo(function UspStrip() {
  const { colors } = useTheme();
  // The delivery promise is whatever the admin has set right now.
  const delivery = storeDeliveryCopy(useShippingSettings().data);
  const usps = [{ id: 'delivery', ...delivery, icon: Truck }, ...USPS];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {usps.map(({ id, title, detail, icon: Icon }) => (
        <View key={id} style={[styles.chip, { backgroundColor: colors.secondary }]}>
          <Icon size={18} color={colors.primary} strokeWidth={2.2} />
          <View>
            <Text variant="captionStrong">{title}</Text>
            <Text variant="micro" tone="mutedForeground">
              {detail}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: GUTTER, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md },
});
