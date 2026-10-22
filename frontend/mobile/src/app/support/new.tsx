import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { CATEGORY_LABELS, useCreateTicket, type TicketCategory } from '@/features/support/api';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TicketCategory[];

/** Direct ticket form - used when the assistant is offline, or the customer prefers it. */
export default function NewTicketScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const create = useCreateTicket();
  const [category, setCategory] = useState<TicketCategory | null>(params.orderNumber ? 'ORDER' : null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderNumber, setOrderNumber] = useState(params.orderNumber ?? '');

  const valid = category && subject.trim().length >= 5 && description.trim().length >= 10;

  const submit = () => {
    if (!valid || !category) return;
    create.mutate(
      { category, subject: subject.trim(), description: description.trim(), orderNumber: orderNumber.trim() || undefined },
      {
        onSuccess: (ticket) => {
          haptic.success();
          toast.success(`Ticket ${ticket.ticketNumber} raised`);
          router.replace({ pathname: '/support/[id]', params: { id: ticket.id } });
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Raise a ticket" subtitle="Our team replies within a day" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(250)} style={styles.section}>
          <Text variant="subheading">What’s it about?</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((value) => {
              const selected = category === value;
              return (
                <PressableScale
                  key={value}
                  onPress={() => {
                    haptic.selection();
                    setCategory(value);
                  }}
                  activeScale={0.95}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
                >
                  <Text variant="captionStrong" tone={selected ? 'primary' : 'foreground'}>
                    {CATEGORY_LABELS[value]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
        <TextField label="Order number (optional)" value={orderNumber} onChangeText={(value) => setOrderNumber(value.toUpperCase())} autoCapitalize="characters" maxLength={24} placeholder="e.g. NS-4K7Q2M9X" />
        <TextField label="Subject" value={subject} onChangeText={setSubject} maxLength={200} placeholder="In a few words" />
        <TextField
          label="Describe the problem"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={4000}
          placeholder="What happened, and what would you like us to do?"
          inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button label="Raise ticket" onPress={submit} disabled={!valid} loading={create.isPending} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: GUTTER, gap: 16 },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
