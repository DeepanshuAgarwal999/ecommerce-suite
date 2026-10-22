import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Minus, PackageOpen, Plus, RotateCcw, Truck, Wallet } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { returnableQuantities, returnDaysLeft, useOrder, useRequestReturn } from '@/features/orders/api';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

const REASONS = [
  { value: 'Damaged or defective', hint: 'Broken, torn, stained or not working' },
  { value: 'Wrong item delivered', hint: 'Different product, colour or variant' },
  { value: 'Not as described', hint: 'Looks or feels different from the listing' },
  { value: 'Size or fit issue', hint: 'Doesn’t fit the bed, wall or space' },
  { value: 'Quality not as expected', hint: 'Material or finish below expectations' },
  { value: 'Changed my mind', hint: 'No longer needed' },
];

/**
 * Return request: pick items + quantities, a reason, optional details. The
 * refund shown is an estimate from the order lines (what was actually paid per
 * unit); order-service computes the binding amount the same way.
 */
export default function ReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: order, isLoading } = useOrder(id);
  const request = useRequestReturn(id);

  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<{ refund: number } | null>(null);

  const returnable = useMemo(() => (order ? returnableQuantities(order) : new Map<string, number>()), [order]);
  const daysLeft = order ? returnDaysLeft(order) : null;

  const estimate = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => {
      const quantity = selected[item.id] ?? 0;
      if (!quantity) return sum;
      return sum + Math.round((item.lineTotal - (item.discount ?? 0)) / item.quantity) * quantity;
    }, 0);
  }, [order, selected]);

  const itemCount = Object.values(selected).reduce((sum, quantity) => sum + quantity, 0);
  const needsDetails = reason !== null && reason !== 'Changed my mind';

  const toggle = (itemId: string) => {
    haptic.selection();
    setSelected((current) => {
      if (current[itemId]) {
        const { [itemId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [itemId]: 1 };
    });
  };

  const setQuantity = (itemId: string, quantity: number) => {
    const max = returnable.get(itemId) ?? 0;
    haptic.light();
    setSelected((current) => ({ ...current, [itemId]: Math.max(1, Math.min(max, quantity)) }));
  };

  const submit = () => {
    if (!reason || itemCount === 0) return;
    request.mutate(
      {
        items: Object.entries(selected).map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reason,
        description: details.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          haptic.success();
          setDone({ refund: created.refundAmount });
        },
      },
    );
  };

  if (done) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.badge, { backgroundColor: colors.success }]}>
          <Check size={52} color="#fff" strokeWidth={3} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.doneCopy}>
          <Text variant="display" align="center">
            Return requested
          </Text>
          <Text tone="mutedForeground" align="center">
            We’ll confirm a pickup slot shortly. Once the items reach us, {formatPrice(done.refund)} goes back to your original payment method.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(350)} style={styles.steps}>
          <Step icon={<RotateCcw size={16} color={colors.primary} />} title="Request review" detail="Usually within 24 hours" />
          <Step icon={<Truck size={16} color={colors.primary} />} title="Doorstep pickup" detail="Keep the items packed with tags" />
          <Step icon={<Wallet size={16} color={colors.primary} />} title="Refund" detail="5-7 business days after pickup" />
        </Animated.View>
        <Button label="Back to order" onPress={() => router.back()} fullWidth size="lg" />
      </View>
    );
  }

  if (isLoading || !order) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Return items" />
        <View style={styles.body}>
          <Skeleton height={90} radius={16} />
          <Skeleton height={90} radius={16} />
        </View>
      </View>
    );
  }

  const anyReturnable = [...returnable.values()].some((quantity) => quantity > 0);
  if (daysLeft === null || !anyReturnable) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Return items" />
        <EmptyState
          icon={<PackageOpen size={36} color={colors.primary} />}
          title={!anyReturnable ? 'Everything is already being returned' : 'Return window closed'}
          description={!anyReturnable ? 'Track the return on your order page.' : 'Returns are accepted within 7 days of delivery. Need help? Ask our assistant.'}
          actionLabel="Back to order"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Return items" subtitle={`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to return`} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled">
        <Section index={1} title="What are you returning?">
          {order.items.map((item) => {
            const max = returnable.get(item.id) ?? 0;
            const quantity = selected[item.id] ?? 0;
            const checked = quantity > 0;
            return (
              <Animated.View key={item.id} layout={LinearTransition.springify().damping(18)}>
                <PressableScale
                  onPress={() => max > 0 && toggle(item.id)}
                  disabled={max === 0}
                  activeScale={0.99}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: max === 0 }}
                  style={[styles.item, { backgroundColor: colors.card, borderColor: checked ? colors.primary : colors.border, borderWidth: checked ? 2 : StyleSheet.hairlineWidth }]}
                >
                  <View style={[styles.check, { borderColor: checked ? colors.primary : colors.input, backgroundColor: checked ? colors.primary : 'transparent' }]}>
                    {checked ? <Check size={13} color="#fff" strokeWidth={3.5} /> : null}
                  </View>
                  <View style={[styles.thumb, { backgroundColor: colors.muted }]}>
                    {item.imageUrl ? <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="captionStrong" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text variant="caption" tone="mutedForeground">
                      {max === 0 ? 'Already in a return' : `Bought ${item.quantity} · ${formatPrice(Math.round(item.lineTotal / item.quantity))} each`}
                    </Text>
                  </View>
                  {checked && max > 1 ? (
                    <View style={[styles.stepper, { borderColor: colors.primary }]}>
                      <Pressable onPress={() => setQuantity(item.id, quantity - 1)} hitSlop={8} accessibilityLabel="Fewer">
                        <Minus size={14} color={colors.primary} strokeWidth={3} />
                      </Pressable>
                      <Text variant="captionStrong" tabular tone="primary">
                        {quantity}
                      </Text>
                      <Pressable onPress={() => setQuantity(item.id, quantity + 1)} hitSlop={8} disabled={quantity >= max} accessibilityLabel="More">
                        <Plus size={14} color={colors.primary} strokeWidth={3} />
                      </Pressable>
                    </View>
                  ) : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </Section>

        <Section index={2} title="Why are you returning it?">
          {REASONS.map((option) => {
            const active = reason === option.value;
            return (
              <PressableScale
                key={option.value}
                onPress={() => {
                  haptic.selection();
                  setReason(option.value);
                }}
                activeScale={0.99}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.reason, { backgroundColor: active ? colors.secondary : colors.card, borderColor: active ? colors.primary : colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" tone={active ? 'primary' : 'foreground'}>
                    {option.value}
                  </Text>
                  <Text variant="caption" tone="mutedForeground">
                    {option.hint}
                  </Text>
                </View>
                <View style={[styles.radio, { borderColor: active ? colors.primary : colors.input }]}>
                  {active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </Section>

        {reason ? (
          <Animated.View entering={FadeInDown.duration(250)}>
            <Section index={3} title={needsDetails ? 'Tell us what happened' : 'Anything else? (optional)'}>
              <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.input }]}>
                <TextInput
                  value={details}
                  onChangeText={(text) => setDetails(text.slice(0, 1000))}
                  placeholder={needsDetails ? 'e.g. The left corner of the frame arrived cracked' : 'Optional'}
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, { color: colors.foreground }]}
                  accessibilityLabel="Return details"
                />
                <Text variant="micro" tone="mutedForeground" align="right">
                  {details.length}/1000
                </Text>
              </View>
            </Section>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.refundRow}>
          <Text variant="caption" tone="mutedForeground">
            Estimated refund{itemCount > 0 ? ` · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : ''}
          </Text>
          <Text variant="price" tabular>
            {formatPrice(estimate)}
          </Text>
        </View>
        <Button
          label="Request return"
          onPress={submit}
          disabled={itemCount === 0 || !reason || (needsDetails && details.trim().length < 5)}
          loading={request.isPending}
          fullWidth
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(280)} style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
          <Text variant="micro" style={{ color: colors.primaryForeground }}>
            {index}
          </Text>
        </View>
        <Text variant="subheading">{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

function Step({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepIcon, { backgroundColor: colors.secondary }]}>{icon}</View>
      <View>
        <Text variant="captionStrong">{title}</Text>
        <Text variant="caption" tone="mutedForeground">
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: GUTTER + 8, gap: 22 },
  body: { padding: GUTTER, gap: 20 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  field: { borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  input: { fontFamily: fonts.body, fontSize: 15, minHeight: 100 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  refundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  doneCopy: { gap: 10 },
  steps: { alignSelf: 'stretch', gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
