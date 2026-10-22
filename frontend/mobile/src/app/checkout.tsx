import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banknote, CircleAlert, Lock, MapPinPlus, ShieldCheck, Wallet } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { pickAddress, useAddresses } from '@/features/address/api';
import { AddressCard } from '@/features/address/components/address-card';
import { useIsSignedIn } from '@/features/auth/session';
import { useCartLines, useCartStore } from '@/features/cart/store';
import type { CartLine } from '@/features/cart/types';
import { useCheckoutStore } from '@/features/checkout/store';
import { PROVIDER_LABELS } from '@/features/payments/adapters';
import { usePaymentConfig } from '@/features/payments/api';
import { PaymentWidgetHost } from '@/features/payments/components/payment-widget-host';
import type { PaymentChoice } from '@/features/payments/types';
import { useOrderQuote, usePayNow } from '@/features/payments/use-pay-now';
import { errorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const STEP_LABEL = { placing: 'Placing your order…', opening: 'Opening payment…', confirming: 'Confirming payment…' } as const;

/**
 * Single-page checkout (Flipkart/Zepto style): address -> items -> payment ->
 * the server's exact quote -> Pay. The total shown is POST /orders/quote, the
 * same pricing path order creation uses, so the number on the button is the
 * number charged.
 */
export default function CheckoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signedIn = useIsSignedIn();

  const mode = useCheckoutStore((state) => state.mode);
  const buyNowLine = useCheckoutStore((state) => state.buyNowLine);
  const addressId = useCheckoutStore((state) => state.addressId);
  const choice = useCheckoutStore((state) => state.paymentChoice);
  const setChoice = useCheckoutStore((state) => state.setPaymentChoice);
  const cartLines = useCartLines();

  const lines: CartLine[] = useMemo(() => (mode === 'buy-now' && buyNowLine ? [buyNowLine] : cartLines), [mode, buyNowLine, cartLines]);
  const items = useMemo(
    () => lines.map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })),
    [lines],
  );

  const addresses = useAddresses();
  const address = pickAddress(addresses.data, addressId);
  const quote = useOrderQuote(items, choice, address?.pincode);
  const provider = usePaymentConfig().data?.provider;

  const onPaid = useCallback(
    ({ orderId, orderNumber }: { orderId: string; orderNumber: string }) => {
      haptic.success();
      if (useCheckoutStore.getState().mode === 'cart') useCartStore.getState().clear();
      useCheckoutStore.getState().complete();
      router.replace({ pathname: '/order/success', params: { id: orderId, number: orderNumber } });
    },
    [router],
  );

  const { phase, pay, busy } = usePayNow({
    items,
    addressId: address?.id ?? null,
    pincode: address?.pincode,
    brandColor: colors.primary,
    onPaid,
  });

  // Don't let a hardware back press abandon a payment mid-flight.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => busy);
    return () => sub.remove();
  }, [busy]);

  useEffect(() => {
    if (!signedIn) router.replace('/login');
  }, [signedIn, router]);

  if (lines.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Checkout" />
        <View style={styles.center}>
          <Text variant="heading">Nothing to check out</Text>
          <Button label="Back to shopping" onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  const total = quote.data?.totals.grandTotal;
  const payLabel = phase.kind === 'working' ? STEP_LABEL[phase.step] : choice === 'COD' ? 'Place order' : total !== undefined ? `Pay ${formatPrice(total)}` : 'Pay';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Checkout" subtitle={`${lines.length} ${lines.length === 1 ? 'item' : 'items'}`} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* 1. Address */}
        <Section index={1} title="Delivery address">
          {addresses.isLoading ? (
            <Skeleton height={110} radius={16} />
          ) : address ? (
            <AddressCard
              address={address}
              actions={
                <PressableScale onPress={() => router.push({ pathname: '/addresses', params: { pick: '1' } })} hitSlop={8} disabled={busy}>
                  <Text variant="captionStrong" tone="primary">
                    Change address
                  </Text>
                </PressableScale>
              }
            />
          ) : (
            <PressableScale
              onPress={() => router.push({ pathname: '/address/edit', params: { select: '1' } })}
              activeScale={0.98}
              style={[styles.addAddress, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
            >
              <MapPinPlus size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" tone="primary">
                  Add a delivery address
                </Text>
                <Text variant="caption" tone="mutedForeground">
                  Takes 20 seconds with your current location
                </Text>
              </View>
            </PressableScale>
          )}
        </Section>

        {/* 2. Items */}
        <Section index={2} title="Order summary">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {lines.map((line) => (
              <View key={line.productId} style={styles.item}>
                <View style={[styles.thumb, { backgroundColor: colors.muted }]}>
                  <Image source={line.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="captionStrong" numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text variant="caption" tone="mutedForeground">
                    Qty {line.quantity}
                  </Text>
                </View>
                <Text variant="captionStrong" tabular>
                  {formatPrice(line.pricePaise * line.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* 3. Payment */}
        <Section index={3} title="Payment method">
          <PaymentOption
            value="ONLINE"
            selected={choice === 'ONLINE'}
            onSelect={setChoice}
            disabled={busy}
            icon={<Wallet size={20} color={colors.primary} />}
            title="Pay online"
            detail={provider ? (PROVIDER_LABELS[provider] ?? 'UPI, cards, netbanking & wallets') : 'UPI, cards, netbanking & wallets'}
          />
          <PaymentOption
            value="COD"
            selected={choice === 'COD'}
            onSelect={setChoice}
            disabled={busy}
            icon={<Banknote size={20} color={colors.primary} />}
            title="Cash on delivery"
            detail={quote.data && choice === 'COD' && quote.data.totals.codFee > 0 ? `${formatPrice(quote.data.totals.codFee)} handling fee` : 'Pay when it arrives'}
          />
        </Section>

        {/* Bill from the server's quote */}
        <View style={[styles.card, styles.bill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text variant="subheading">Price details</Text>
          {quote.isLoading ? (
            <>
              <Skeleton height={14} />
              <Skeleton height={14} width="70%" />
              <Skeleton height={18} width="50%" />
            </>
          ) : quote.data ? (
            <Animated.View entering={FadeIn} style={{ gap: 8 }}>
              <BillRow label="Item total" value={formatPrice(quote.data.totals.itemTotal)} />
              {quote.data.totals.discountTotal > 0 ? <BillRow label="Discount" value={`-${formatPrice(quote.data.totals.discountTotal)}`} tone="success" /> : null}
              <BillRow label="Delivery" value={quote.data.totals.shippingTotal === 0 ? 'FREE' : formatPrice(quote.data.totals.shippingTotal)} tone={quote.data.totals.shippingTotal === 0 ? 'success' : undefined} />
              {quote.data.totals.taxTotal > 0 ? <BillRow label="GST" value={formatPrice(quote.data.totals.taxTotal)} /> : null}
              {quote.data.totals.codFee > 0 ? <BillRow label="COD fee" value={formatPrice(quote.data.totals.codFee)} /> : null}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <BillRow label="Total payable" value={formatPrice(quote.data.totals.grandTotal)} strong />
            </Animated.View>
          ) : quote.error ? (
            <View style={styles.errorRow}>
              <CircleAlert size={16} color={colors.destructive} />
              <Text variant="caption" tone="destructive" style={{ flex: 1 }}>
                {errorMessage(quote.error, 'Could not price your order.')}
              </Text>
              <PressableScale onPress={() => void quote.refetch()} hitSlop={8}>
                <Text variant="captionStrong" tone="primary">
                  Retry
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>

        <View style={styles.trust}>
          <ShieldCheck size={16} color={colors.success} />
          <Text variant="caption" tone="mutedForeground">
            Safe and secure payments. 7-day easy returns.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {phase.kind === 'declined' || phase.kind === 'error' || phase.kind === 'dismissed' ? (
          <Animated.View entering={FadeInDown} layout={LinearTransition} style={[styles.notice, { backgroundColor: phase.kind === 'dismissed' ? colors.secondary : colors.destructiveWash }]}>
            <CircleAlert size={16} color={phase.kind === 'dismissed' ? colors.primary : colors.destructive} />
            <Text variant="caption" style={{ flex: 1 }} tone={phase.kind === 'dismissed' ? 'foreground' : 'destructive'}>
              {phase.kind === 'dismissed' ? 'Payment not completed. Your order is saved - tap Pay to try again.' : phase.message}
            </Text>
          </Animated.View>
        ) : null}
        <Button
          label={payLabel}
          onPress={() => void pay(choice)}
          loading={false}
          disabled={!address || !quote.data || busy}
          icon={choice === 'ONLINE' && !busy ? <Lock size={16} color={colors.primaryForeground} /> : undefined}
          fullWidth
          size="lg"
        />
      </View>

      <PaymentWidgetHost />
    </View>
  );
}

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)} style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.step, { backgroundColor: colors.primary }]}>
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

function PaymentOption({
  value,
  selected,
  onSelect,
  disabled,
  icon,
  title,
  detail,
}: {
  value: PaymentChoice;
  selected: boolean;
  onSelect: (value: PaymentChoice) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => {
        haptic.selection();
        onSelect(value);
      }}
      disabled={disabled}
      activeScale={0.99}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.optionIcon, { backgroundColor: colors.secondary }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="mutedForeground">
          {detail}
        </Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </PressableScale>
  );
}

function BillRow({ label, value, tone, strong }: { label: string; value: string; tone?: 'success'; strong?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text variant={strong ? 'subheading' : 'caption'} tone={strong ? 'foreground' : 'mutedForeground'}>
        {label}
      </Text>
      <Text variant={strong ? 'subheading' : 'captionStrong'} tone={tone ?? 'foreground'} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  body: { padding: GUTTER, gap: 20 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addAddress: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  optionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  bill: { paddingVertical: 14, gap: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md },
});
