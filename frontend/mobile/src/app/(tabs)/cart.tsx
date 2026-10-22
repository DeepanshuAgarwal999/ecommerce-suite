import { memo, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeOutLeft, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag, Truck } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { SectionHeader } from '@/components/common/section-header';
import { TAB_BAR_HEIGHT } from '@/components/navigation/tab-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Price } from '@/components/ui/price';
import { Text } from '@/components/ui/text';
import { useRequireAuth } from '@/features/auth/session';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { useCartLines, useCartTotals } from '@/features/cart/store';
import { useCheckoutStore } from '@/features/checkout/store';
import type { CartLine } from '@/features/cart/types';
import { ProductRail } from '@/features/catalog/components/product-rail';
import type { Product } from '@/features/catalog/types';
import { useCartRecommendations } from '@/features/recommendations/api';
import { formatPrice } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

export default function CartScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lines = useCartLines();
  const totals = useCartTotals();
  const requireAuth = useRequireAuth();
  const productIds = useMemo(() => lines.map((line) => line.productId), [lines]);
  const recs = useCartRecommendations(productIds);

  if (lines.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="My cart" back={false} />
        <EmptyState
          icon={<ShoppingBag size={36} color={colors.primary} />}
          title="Your cart is empty"
          description="Bedding, decor and kitchen picks from 1,200+ makers are a tap away."
          actionLabel="Start shopping"
          onAction={() => router.navigate('/')}
        />
      </View>
    );
  }

  const checkout = () =>
    requireAuth(() => {
      useCheckoutStore.getState().startCartCheckout();
      router.push('/checkout');
    });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="My cart" subtitle={`${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'}`} back={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 110, gap: 14, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
        {totals.freeDeliveryThreshold !== null && totals.freeDeliveryRemaining !== null ? (
          <FreeDeliveryProgress threshold={totals.freeDeliveryThreshold} remaining={totals.freeDeliveryRemaining} />
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {lines.map((line) => (
            <Animated.View key={line.productId} exiting={FadeOutLeft.duration(200)} layout={LinearTransition.springify().damping(18)}>
              <CartLineRow line={line} />
            </Animated.View>
          ))}
        </View>

        {recs.data && recs.data.items.length > 0 ? (
          <View>
            <SectionHeader title="You might also like" />
            <ProductRail products={recs.data.items} />
          </View>
        ) : null}

        <View style={[styles.card, styles.bill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text variant="subheading">Bill details</Text>
          <BillRow label="Item total" value={formatPrice(totals.subtotalPaise + totals.savingsPaise)} />
          {totals.savingsPaise > 0 ? <BillRow label="Discount" value={`-${formatPrice(totals.savingsPaise)}`} tone="success" /> : null}
          <BillRow
            label="Delivery"
            value={!totals.deliveryKnown ? 'At checkout' : totals.deliveryFeePaise === 0 ? 'FREE' : formatPrice(totals.deliveryFeePaise)}
            tone={totals.deliveryKnown && totals.deliveryFeePaise === 0 ? 'success' : undefined}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <BillRow label="To pay" value={formatPrice(totals.totalPaise)} strong />
          <Text variant="micro" tone="mutedForeground">
            Final amount incl. taxes is confirmed at checkout.
          </Text>
        </View>

        {totals.savingsPaise > 0 ? (
          <View style={[styles.savings, { backgroundColor: colors.secondary }]}>
            <Text variant="captionStrong" tone="success">
              You’re saving {formatPrice(totals.savingsPaise)} on this order
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.checkout, { bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8), backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text variant="price" tabular>
            {formatPrice(totals.totalPaise)}
          </Text>
          <Text variant="micro" tone="mutedForeground">
            TOTAL
          </Text>
        </View>
        <Button label="Proceed to checkout" onPress={checkout} style={{ flex: 1.6 }} />
      </View>
    </View>
  );
}

/**
 * Animated bar towards the free-delivery threshold, the classic basket-size nudge.
 * Threshold and remaining come from the server estimate (admin-managed), and are
 * measured on the items that qualify - bulky items with their own charge don't count.
 */
function FreeDeliveryProgress({ threshold, remaining }: { threshold: number; remaining: number }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const ratio = threshold > 0 ? Math.min(1, (threshold - remaining) / threshold) : 1;

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 500 });
  }, [ratio, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.card, styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.progressRow}>
        <Truck size={18} color={remaining === 0 ? colors.success : colors.primary} />
        <Text variant="captionStrong" style={{ flex: 1 }}>
          {remaining === 0 ? 'Yay! You get FREE delivery' : `Add ${formatPrice(remaining)} more for FREE delivery`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <Animated.View style={[styles.fill, { backgroundColor: remaining === 0 ? colors.success : colors.primary }, fill]} />
      </View>
    </View>
  );
}

const CartLineRow = memo(function CartLineRow({ line }: { line: CartLine }) {
  const { colors } = useTheme();
  const router = useRouter();
  // The stepper takes a Product; a cart line carries every field it reads.
  const product = useMemo<Product>(
    () => ({
      id: line.productId,
      slug: line.slug,
      name: line.name,
      brand: '',
      description: '',
      images: [{ url: line.imageUrl, alt: line.name }],
      pricePaise: line.pricePaise,
      mrpPaise: line.mrpPaise,
      variantLabel: line.variantLabel,
      variantId: line.variantId,
      rating: 0,
      ratingCount: 0,
      inStock: true,
      maxPerOrder: line.maxPerOrder,
      categorySlug: '',
      tags: [],
    }),
    [line],
  );

  return (
    <View style={styles.line}>
      <PressableScale
        onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: line.slug } })}
        activeScale={0.95}
        style={[styles.lineImage, { backgroundColor: colors.muted }]}
      >
        <Image source={line.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
      </PressableScale>
      <View style={styles.lineInfo}>
        <Text variant="captionStrong" numberOfLines={2}>
          {line.name}
        </Text>
        {line.variantLabel ? (
          <Text variant="micro" tone="mutedForeground">
            {line.variantLabel}
          </Text>
        ) : null}
        <Price pricePaise={line.pricePaise * line.quantity} mrpPaise={line.mrpPaise * line.quantity} size="sm" showDiscount={false} />
      </View>
      <AddToCartButton product={product} />
    </View>
  );
});

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
  card: { marginHorizontal: GUTTER, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  progressCard: { paddingVertical: 12, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  lineImage: { width: 62, height: 62, borderRadius: radius.sm, overflow: 'hidden' },
  lineInfo: { flex: 1, gap: 3 },
  bill: { paddingVertical: 14, gap: 8 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  savings: { marginHorizontal: GUTTER, padding: 12, borderRadius: radius.md, alignItems: 'center' },
  checkout: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
