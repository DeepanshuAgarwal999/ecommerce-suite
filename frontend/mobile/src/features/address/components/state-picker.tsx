import { memo, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';
import { INDIAN_STATES } from '../indian-states';

interface StatePickerProps {
  value: string;
  onChange: (state: string) => void;
  error?: string;
}

/** Field + searchable full-screen list of states and union territories. */
export const StatePicker = memo(function StatePicker({ value, onChange, error }: StatePickerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const states = useMemo(
    () => INDIAN_STATES.filter((state) => state.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <View style={styles.root}>
      <Text variant="captionStrong" tone={error ? 'destructive' : 'mutedForeground'}>
        State
      </Text>
      <PressableScale
        onPress={() => setOpen(true)}
        activeScale={0.99}
        accessibilityLabel={value ? `State, ${value}` : 'Choose state'}
        style={[styles.field, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.input }]}
      >
        <Text tone={value ? 'foreground' : 'mutedForeground'} style={{ flex: 1 }}>
          {value || 'Choose state'}
        </Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: 16 }]}>
          <View style={styles.sheetHeader}>
            <Text variant="heading">Choose state</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.search, { backgroundColor: colors.muted, color: colors.foreground }]}
          />
          <FlatList
            data={states}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery('');
                }}
                style={[styles.option, { borderBottomColor: colors.border }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: item === value }}
              >
                <Text style={{ flex: 1 }} tone={item === value ? 'primary' : 'foreground'}>
                  {item}
                </Text>
                {item === value ? <Check size={18} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 6 },
  field: { height: 50, borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GUTTER, paddingBottom: 12 },
  search: { marginHorizontal: GUTTER, height: 44, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 15, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
