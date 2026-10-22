import { useEffect, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BadgeCheck, MapPin, PackageX, RotateCcw, Share2, ShoppingBag, Star, Truck } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/section-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { firstInSession, track } from '@/features/analytics/track';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { useCartCount, useLineQuantity } from '@/features/cart/store';
import { toCartLine } from '@/features/cart/types';
import { useRequireAuth } from '@/features/auth/session';
import { useCheckoutStore } from '@/features/checkout/store';
import { catalogApi } from '@/features/catalog/api';
import { ImageGallery } from '@/features/catalog/components/image-gallery';
import { ProductRail } from '@/features/catalog/components/product-rail';
import { useProduct } from '@/features/catalog/hooks';
import type { Product } from '@/features/catalog/types';
import { useLocationStore } from '@/features/location/store';
import { useProductRecommendations } from '@/features/recommendations/api';
import { productDeliveryCopy, useProductDelivery } from '@/features/shipping/api';
import { WishlistButton } from '@/features/wishlist/wishlist-button';
import { formatCompact, formatRating, formatShortDate } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: product, isError, refetch, isPlaceholderData } = useProduct(slug);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    if (product && !isPlaceholderData && firstInSession(`view:${product.id}`)) {
      track('view', { productId: product.id });
    }
  }, [product, isPlaceholderData]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // The app bar fades in once the gallery has mostly scrolled away.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [width * 0.55, width * 0.8], [0, 1], Extrapolation.CLAMP),
  }));

  if (isError && !product) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          icon={<PackageX size={36} color={colors.primary} />}
          title="This product isn't available"
          description="It may have sold out or been removed."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {product ? <ImageGallery images={product.images} scrollY={scrollY} /> : <Skeleton height={width} radius={0} />}

        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {product ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.info}>
              <Text variant="caption" tone="primary" style={styles.brand}>
                {product.brand}
              </Text>
              <Text variant="title">{product.name}</Text>
              {product.variantLabel ? (
                <Text variant="caption" tone="mutedForeground">
                  {product.variantLabel}
                </Text>
              ) : null}

              {product.ratingCount > 0 ? (
                <View style={styles.ratingRow}>
                  <View style={[styles.ratingPill, { backgroundColor: colors.success }]}>
                    <Text variant="captionStrong" style={{ color: colors.successForeground }}>
                      {formatRating(product.rating)}
                    </Text>
                    <Star size={11} color={colors.successForeground} fill={colors.successForeground} />
                  </View>
                  <Text variant="caption" tone="mutedForeground">
                    {formatCompact(product.ratingCount)} ratings
                  </Text>
                </View>
              ) : null}

              <View style={styles.priceRow}>
                <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} size="lg" />
              </View>
              <Text variant="micro" tone="mutedForeground">
                Inclusive of all taxes
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.info}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="85%" height={22} />
              <Skeleton width="40%" height={24} />
            </View>
          )}

          <DeliveryCard />
          {product ? <Promises productId={product.id} /> : null}

          {product?.description ? (
            <View style={styles.block}>
              <Text variant="subheading">About this item</Text>
              <Description text={product.description} />
            </View>
          ) : null}

          {product ? <Reviews productId={product.id} title={product.name} image={product.images[0]?.url} /> : null}
          {product ? <Recommendations productId={product.id} /> : null}
        </View>
      </Animated.ScrollView>

      {/* Floating controls over the gallery, then a solid bar once scrolled. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, barStyle]} />
        <RoundButton label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ArrowLeft size={20} color={colors.foreground} strokeWidth={2.4} />
        </RoundButton>
        <Animated.View style={[styles.barTitle, barStyle]}>
          <Text variant="subheading" numberOfLines={1}>
            {product?.name}
          </Text>
        </Animated.View>
        {product ? <WishlistButton productId={product.id} variantId={product.variantId} size={18} /> : null}
        <RoundButton
          label="Share"
          onPress={() => product && void Share.share({ message: `${product.name} on Nestora`, url: `https://nestora.example/p/${product.slug}` })}
        >
          <Share2 size={18} color={colors.foreground} strokeWidth={2.4} />
        </RoundButton>
        <CartShortcut />
      </View>

      {product ? <ProductFooter product={product} /> : null}
    </View>
  );
}

function ProductFooter({ product }: { product: Product }) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const quantity = useLineQuantity(product.id);
  const requireAuth = useRequireAuth();
  const delivery = useProductDelivery(product.id);
  // Flipkart-style "Buy now": checks out this one item without touching the cart.
  const buyNow = () =>
    requireAuth(() => {
      useCheckoutStore.getState().startBuyNow(toCartLine(product, Math.max(1, quantity)));
      router.push('/checkout');
    });
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
      <View style={styles.footerPrice}>
        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} showDiscount={false} />
        <Text variant="micro" tone="mutedForeground">
          {quantity > 0 ? `${quantity} in cart` : delivery.data ? productDeliveryCopy(delivery.data.settings, delivery.data.rule) : ' '}
        </Text>
      </View>
      <View style={styles.footerActions}>
        {quantity > 0 ? (
          <>
            <AddToCartButton product={product} size="md" />
            <Button label="Go to cart" onPress={() => router.push('/cart')} style={styles.footerCta} />
          </>
        ) : (
          <>
            <View style={styles.footerAdd}>
              <AddToCartButton product={product} size="md" block />
            </View>
            {product.inStock ? <Button label="Buy now" onPress={buyNow} style={styles.footerCta} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

function RoundButton({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} activeScale={0.88} hitSlop={6} accessibilityLabel={label} style={[styles.round, { backgroundColor: colors.card }]}>
      {children}
    </PressableScale>
  );
}

function CartShortcut() {
  const { colors } = useTheme();
  const router = useRouter();
  const count = useCartCount();
  return (
    <RoundButton label={`Cart, ${count} items`} onPress={() => router.push('/cart')}>
      <ShoppingBag size={18} color={colors.foreground} strokeWidth={2.4} />
      {count > 0 ? (
        <View style={[styles.cartDot, { backgroundColor: colors.highlight }]}>
          <Text variant="micro" style={{ color: colors.highlightForeground, fontSize: 9 }}>
            {count}
          </Text>
        </View>
      ) : null}
    </RoundButton>
  );
}

function DeliveryCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const location = useLocationStore((state) => state.location);
  // Standard home & living promise: 3 days out (the backend has no per-pincode ETA yet).
  const [eta] = useState(() => formatShortDate(new Date(Date.now() + 3 * 86_400_000)));

  return (
    <PressableScale onPress={() => router.push('/location')} activeScale={0.99} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <MapPin size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="captionStrong">{location ? `Deliver to ${location.pincode}` : 'Check delivery'}</Text>
        <Text variant="caption" tone="mutedForeground">
          {location ? `Get it by ${eta}` : 'Add your pincode for delivery dates'}
        </Text>
      </View>
      <Text variant="captionStrong" tone="primary">
        {location ? 'Change' : 'Add'}
      </Text>
    </PressableScale>
  );
}

function Promises({ productId }: { productId: string }) {
  const { colors } = useTheme();
  const delivery = useProductDelivery(productId);
  const items = [
    { icon: Truck, label: delivery.data ? productDeliveryCopy(delivery.data.settings, delivery.data.rule) : 'Delivery across India' },
    { icon: RotateCcw, label: '7-day easy returns' },
    { icon: BadgeCheck, label: 'Quality checked' },
  ];
  return (
    <View style={styles.promises}>
      {items.map(({ icon: Icon, label }) => (
        <View key={label} style={[styles.promise, { backgroundColor: colors.secondary }]}>
          <Icon size={18} color={colors.primary} />
          <Text variant="micro" align="center">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220;
  return (
    <View style={{ gap: 6 }}>
      <Text tone="mutedForeground" numberOfLines={expanded || !long ? undefined : 4}>
        {text}
      </Text>
      {long ? (
        <PressableScale onPress={() => setExpanded((value) => !value)} hitSlop={8}>
          <Text variant="captionStrong" tone="primary">
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function Reviews({ productId, title, image }: { productId: string; title: string; image?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const write = () =>
    requireAuth(() => router.push({ pathname: '/review/[productId]', params: { productId, title, image: image ?? '' } }));
  const { data } = useQuery({
    queryKey: ['catalog', 'reviews', productId, 'top'],
    queryFn: () => catalogApi.listReviews(productId, { limit: 3 }),
    staleTime: 5 * 60_000,
  });
  const header = (
    <View style={styles.reviewHeader}>
      <Text variant="subheading">Customer reviews</Text>
      <PressableScale onPress={write} hitSlop={8} accessibilityLabel="Write a review">
        <Text variant="captionStrong" tone="primary">
          Write a review
        </Text>
      </PressableScale>
    </View>
  );

  if (!data || data.items.length === 0) {
    return (
      <View style={styles.block}>
        {header}
        <Text variant="caption" tone="mutedForeground">
          No reviews yet. Bought this? Be the first to share how it looks at home.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {header}
      {data.items.map((review) => (
        <View key={review.id} style={[styles.review, { borderColor: colors.border }]}>
          <View style={styles.ratingRow}>
            <View style={[styles.ratingPill, { backgroundColor: colors.success }]}>
              <Text variant="micro" style={{ color: colors.successForeground }}>
                {review.rating}
              </Text>
              <Star size={9} color={colors.successForeground} fill={colors.successForeground} />
            </View>
            {review.title ? <Text variant="captionStrong">{review.title}</Text> : null}
          </View>
          {review.comment ? (
            <Text variant="caption" tone="mutedForeground" numberOfLines={4}>
              {review.comment}
            </Text>
          ) : null}
          <Text variant="micro" tone="mutedForeground">
            {review.userName}
            {review.isVerifiedPurchase ? ' · Verified purchase' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Recommendations({ productId }: { productId: string }) {
  const { data } = useProductRecommendations(productId);
  if (!data) return null;
  const rails = [
    { key: 'together', title: data.boughtTogether.source === 'learned' ? 'Frequently bought together' : 'Goes well with', list: data.boughtTogether },
    { key: 'viewed', title: 'Customers also viewed', list: data.alsoViewed },
    { key: 'similar', title: 'Similar products', list: data.similar },
  ].filter((rail) => rail.list.items.length > 0);

  return (
    <View style={{ gap: 24, marginTop: 8 }}>
      {rails.map((rail) => (
        <View key={rail.key} style={{ marginHorizontal: -GUTTER }}>
          <SectionHeader title={rail.title} />
          <ProductRail products={rail.list.items} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: GUTTER, paddingTop: 18, gap: 16 },
  info: { gap: 6 },
  brand: { textTransform: 'uppercase', letterSpacing: 0.8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  priceRow: { marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  promises: { flexDirection: 'row', gap: 8 },
  promise: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radius.md },
  block: { gap: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  review: { gap: 6, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  barTitle: { flex: 1 },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cartDot: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: { flex: 1 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1.4, justifyContent: 'flex-end' },
  footerAdd: { flex: 1, flexDirection: 'row' },
  footerCta: { height: 44, paddingHorizontal: 14 },
});
