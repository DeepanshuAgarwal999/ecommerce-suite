import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CircleX, LifeBuoy, MapPin, PackageX, RotateCcw, Star, Truck } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import {
  CUSTOMER_CANCELLABLE,
  RETURN_STATUS_META,
  returnableQuantities,
  returnDaysLeft,
  STATUS_META,
  TRACK_STEPS,
  useCancelOrder,
  useOrder,
  type OrderDetail,
  type OrderStatus,
} from '@/features/orders/api';
import { openPaymentWidget } from '@/features/payments/adapters';
import { paymentsApi } from '@/features/payments/api';
import { PaymentWidgetHost } from '@/features/payments/components/payment-widget-host';
import { errorMessage, queryKeys } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const CANCEL_REASONS = ['Ordered by mistake', 'Found a better price', 'Delivery is taking too long', 'Want to change the address', 'Other'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: order, isLoading, isError, refetch, isRefetching } = useOrder(id);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Order details" />
        <View style={styles.body}>
          <Skeleton height={90} radius={16} />
          <Skeleton height={220} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Order details" />
        <EmptyState icon={<PackageX size={36} color={colors.primary} />} title="Order not found" actionLabel="Retry" onAction={() => void refetch()} />
      </View>
    );
  }

  const meta = STATUS_META[order.status];
  const cancellable = CUSTOMER_CANCELLABLE.includes(order.status);
  const address = order.shippingAddress;
  const shipment = order.shipments.find((item) => item.trackingUrl || item.trackingNumber);
  const delivered = order.status === 'DELIVERED';
  const daysLeft = returnDaysLeft(order);
  const canReturn = daysLeft !== null && [...returnableQuantities(order).values()].some((quantity) => quantity > 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title={`Order #${order.orderNumber}`} subtitle={formatDateTime(order.createdAt)} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text variant="caption" tone="mutedForeground">
            STATUS
          </Text>
          <Text variant="title" tone={meta.tone}>
            {meta.label}
          </Text>
          {order.status === 'PENDING_PAYMENT' ? <CompletePayment order={order} /> : null}
          <Tracker order={order} />
          {shipment ? (
            <PressableScale
              onPress={() => shipment.trackingUrl && void Linking.openURL(shipment.trackingUrl)}
              disabled={!shipment.trackingUrl}
              style={[styles.shipment, { backgroundColor: colors.secondary }]}
            >
              <Truck size={18} color={colors.primary} />
              <Text variant="caption" style={{ flex: 1 }}>
                {shipment.courierName ?? 'Courier'} · {shipment.trackingNumber ?? 'Tracking soon'}
              </Text>
              {shipment.trackingUrl ? (
                <Text variant="captionStrong" tone="primary">
                  Track
                </Text>
              ) : null}
            </PressableScale>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text variant="subheading">Items</Text>
          {order.items.map((item) => (
            <PressableScale
              key={item.id}
              onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.productId } })}
              activeScale={0.99}
              style={styles.item}
            >
              <View style={[styles.thumb, { backgroundColor: colors.muted }]}>
                {item.imageUrl ? <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="captionStrong" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text variant="caption" tone="mutedForeground">
                  {item.vendorName} · Qty {item.quantity}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <Text variant="captionStrong" tabular>
                  {formatPrice(item.lineTotal)}
                </Text>
                {delivered ? (
                  <PressableScale
                    onPress={() =>
                      router.push({
                        pathname: '/review/[productId]',
                        params: { productId: item.productId, orderId: order.id, title: item.title, image: item.imageUrl ?? '' },
                      })
                    }
                    hitSlop={6}
                    activeScale={0.92}
                    style={[styles.rate, { borderColor: colors.primary }]}
                    accessibilityLabel={`Rate and review ${item.title}`}
                  >
                    <Star size={11} color={colors.primary} fill={colors.primary} />
                    <Text variant="micro" tone="primary">
                      RATE
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            </PressableScale>
          ))}
        </Animated.View>

        {order.returns?.map((request) => {
          const meta = RETURN_STATUS_META[request.status];
          return (
            <Animated.View key={request.id} entering={FadeInDown.delay(120).duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowCenter}>
                <RotateCcw size={16} color={colors[meta.tone]} />
                <Text variant="subheading" tone={meta.tone}>
                  {meta.label}
                </Text>
              </View>
              <Text variant="caption" tone="mutedForeground">
                {meta.detail}
              </Text>
              <Row label={`${request.items.reduce((sum, line) => sum + line.quantity, 0)} item(s) · ${request.reason}`} value={formatPrice(request.refundAmount)} />
            </Animated.View>
          );
        })}

        {canReturn ? (
          <PressableScale
            onPress={() => router.push({ pathname: '/orders/[id]/return', params: { id: order.id } })}
            activeScale={0.98}
            style={[styles.returnCta, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.returnIcon, { backgroundColor: colors.secondary }]}>
              <RotateCcw size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Return items</Text>
              <Text variant="caption" tone="mutedForeground">
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left · free doorstep pickup
              </Text>
            </View>
            <Text variant="captionStrong" tone="primary">
              Start
            </Text>
          </PressableScale>
        ) : null}

        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowCenter}>
            <MapPin size={16} color={colors.primary} />
            <Text variant="subheading">Delivering to</Text>
          </View>
          <Text variant="bodyStrong">{address.fullName}</Text>
          <Text variant="caption" tone="mutedForeground">
            {[address.line1, address.line2, address.landmark, address.city, address.state && `${address.state} - ${address.pincode}`].filter(Boolean).join(', ')}
          </Text>
          {address.phone ? (
            <Text variant="caption" tone="mutedForeground">
              Phone: {address.phone}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text variant="subheading">Payment</Text>
          <Row label="Item total" value={formatPrice(order.itemTotal)} />
          {order.discountTotal > 0 ? <Row label="Discount" value={`-${formatPrice(order.discountTotal)}`} /> : null}
          <Row label="Delivery" value={order.shippingTotal === 0 ? 'FREE' : formatPrice(order.shippingTotal)} />
          {order.taxTotal > 0 ? <Row label="GST" value={formatPrice(order.taxTotal)} /> : null}
          {order.codFee > 0 ? <Row label="COD fee" value={formatPrice(order.codFee)} /> : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Total" value={formatPrice(order.grandTotal)} strong />
          <Text variant="caption" tone="mutedForeground">
            {order.paymentMethod === 'COD' ? 'Cash on delivery' : order.paidAt ? `Paid online on ${formatDateTime(order.paidAt)}` : 'Online payment'}
          </Text>
        </Animated.View>

        <PressableScale
          onPress={() => router.push({ pathname: '/support', params: { orderNumber: order.orderNumber } })}
          activeScale={0.98}
          style={[styles.returnCta, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.returnIcon, { backgroundColor: colors.secondary }]}>
            <LifeBuoy size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Need help with this order?</Text>
            <Text variant="caption" tone="mutedForeground">
              Chat with our assistant - instant answers, or a ticket to our team
            </Text>
          </View>
        </PressableScale>

        {cancellable ? <Button label="Cancel order" variant="outline" onPress={() => setCancelOpen(true)} fullWidth /> : null}
      </ScrollView>

      <CancelSheet orderId={order.id} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
      <PaymentWidgetHost />
    </View>
  );
}

/**
 * Vertical delivery tracker. The connector fills to the current step with a
 * timed animation; off-path outcomes (cancelled, returns) get their own end node.
 */
function Tracker({ order }: { order: OrderDetail }) {
  const { colors } = useTheme();
  const reached = new Map<OrderStatus, string>();
  for (const entry of order.statusHistory) if (!reached.has(entry.toStatus)) reached.set(entry.toStatus, entry.createdAt);

  const currentIndex = TRACK_STEPS.indexOf(order.status);
  const lastReached = currentIndex >= 0 ? currentIndex : Math.max(-1, ...TRACK_STEPS.map((step, index) => (reached.has(step) ? index : -1)));
  const offPath = currentIndex < 0 && !['PENDING_PAYMENT', 'DRAFT'].includes(order.status);

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(250, withTiming(Math.max(0, lastReached) / (TRACK_STEPS.length - 1), { duration: 700 }));
  }, [lastReached, fill]);
  const fillStyle = useAnimatedStyle(() => ({ height: `${fill.value * 100}%` }));

  return (
    <View style={styles.tracker}>
      <View style={[styles.rail, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.railFill, { backgroundColor: colors.success }, fillStyle]} />
      </View>
      {TRACK_STEPS.map((step, index) => {
        const done = index <= lastReached;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.node, { backgroundColor: done ? colors.success : colors.card, borderColor: done ? colors.success : colors.input }]}>
              {done ? <Check size={11} color="#fff" strokeWidth={3.5} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant={done ? 'captionStrong' : 'caption'} tone={done ? 'foreground' : 'mutedForeground'}>
                {STATUS_META[step].label}
              </Text>
              {reached.get(step) ? (
                <Text variant="micro" tone="mutedForeground">
                  {formatDateTime(reached.get(step)!)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      {offPath ? (
        <View style={styles.step}>
          <View style={[styles.node, { backgroundColor: colors.destructive, borderColor: colors.destructive }]}>
            <CircleX size={11} color="#fff" strokeWidth={3} />
          </View>
          <Text variant="captionStrong" tone="destructive">
            {STATUS_META[order.status].label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Resume payment on an order whose first attempt was dismissed or declined. */
function CompletePayment({ order }: { order: OrderDetail }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      const session = await paymentsApi.startPayment(order.id);
      const result = await openPaymentWidget(session.provider, session.clientConfig, colors.primary);
      if (result.kind === 'completed') {
        const status = await paymentsApi.confirm(session.paymentId, result.gatewayResponse);
        if (['CAPTURED', 'AUTHORIZED'].includes(status.status)) toast.success('Payment received - your order is confirmed');
        else toast.error(status.failureReason ?? 'Payment not confirmed yet. We’ll update this order automatically.');
      } else if (result.kind === 'failed') {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not start the payment.'));
    } finally {
      setBusy(false);
      void client.invalidateQueries({ queryKey: queryKeys.orders.all });
    }
  };

  return (
    <View style={[styles.payBox, { backgroundColor: colors.secondary }]}>
      <Text variant="caption" style={{ flex: 1 }}>
        Complete the payment within 15 minutes or the order is released.
      </Text>
      <Button label={`Pay ${formatPrice(order.grandTotal)}`} size="sm" onPress={pay} loading={busy} />
    </View>
  );
}

function CancelSheet({ orderId, visible, onClose }: { orderId: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cancel = useCancelOrder(orderId);
  const [reason, setReason] = useState<string | null>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <Text variant="heading">Why are you cancelling?</Text>
        {CANCEL_REASONS.map((option) => {
          const selected = reason === option;
          return (
            <PressableScale
              key={option}
              onPress={() => setReason(option)}
              activeScale={0.99}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.reason, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
            >
              <Text tone={selected ? 'primary' : 'foreground'}>{option}</Text>
            </PressableScale>
          );
        })}
        <Button
          label="Cancel order"
          variant="destructive"
          disabled={!reason}
          loading={cancel.isPending}
          onPress={() => reason && cancel.mutate(reason, { onSuccess: onClose })}
          fullWidth
          size="lg"
        />
      </View>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text variant={strong ? 'subheading' : 'caption'} tone={strong ? 'foreground' : 'mutedForeground'}>
        {label}
      </Text>
      <Text variant={strong ? 'subheading' : 'captionStrong'} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: GUTTER, gap: 14 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  shipment: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, overflow: 'hidden' },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  returnCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  returnIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tracker: { marginTop: 8, gap: 16, position: 'relative' },
  rail: { position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, borderRadius: 1, overflow: 'hidden' },
  railFill: { width: '100%' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  payBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md },
  scrim: { flex: 1 },
  sheet: { paddingHorizontal: GUTTER + 4, paddingTop: 20, gap: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  reason: { padding: 14, borderRadius: radius.md, borderWidth: 1.5 },
});
