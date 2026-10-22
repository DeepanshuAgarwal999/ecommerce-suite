import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Briefcase, House, MapPin } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { addressTitle, formatAddress, type Address } from '../types';

const ICON = { HOME: House, WORK: Briefcase, OTHER: MapPin } as const;

interface AddressCardProps {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  actions?: React.ReactNode;
}

export const AddressCard = memo(function AddressCard({ address, selected, onPress, actions }: AddressCardProps) {
  const { colors } = useTheme();
  const Icon = ICON[address.label];

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      activeScale={0.99}
      accessibilityRole={onPress ? 'radio' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Icon size={16} color={colors.primary} />
        </View>
        <Text variant="subheading" style={{ flex: 1 }}>
          {addressTitle(address)}
        </Text>
        {address.isDefault ? (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text variant="micro" tone="primary">
              DEFAULT
            </Text>
          </View>
        ) : null}
        {onPress ? (
          <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
            {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
          </View>
        ) : null}
      </View>
      <Text variant="bodyStrong">{address.fullName}</Text>
      <Text variant="caption" tone="mutedForeground">
        {formatAddress(address)}
      </Text>
      <Text variant="caption" tone="mutedForeground">
        Phone: {address.phone}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 14, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 8 },
});
