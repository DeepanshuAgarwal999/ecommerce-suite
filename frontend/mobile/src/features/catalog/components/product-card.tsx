import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Price } from '@/components/ui/price';
import { Text } from '@/components/ui/text';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { WishlistButton } from '@/features/wishlist/wishlist-button';
import { discountPercent, formatCompact, formatRating } from '@/lib/format';
import { useStyles, type AppTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  width?: number;
}

/**
 * The one product tile used in rails, grids, search and recommendations.
 * Memoised on the product object; FlashList recycles it, so the image uses
 * `recyclingKey` to avoid flashing the previous product's photo on reuse.
 */
export const ProductCard = memo(function ProductCard({ product, width }: ProductCardProps) {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const off = discountPercent(product.mrpPaise, product.pricePaise);
  const image = product.images[0]?.url;

  const open = useCallback(() => {
    router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
  }, [router, product.slug]);

  return (
    <PressableScale onPress={open} activeScale={0.97} style={[styles.card, width ? { width } : styles.fill]} accessibilityLabel={product.name}>
      <View style={styles.media}>
        <Image
          source={image}
          recyclingKey={product.id}
          style={styles.image}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          accessibilityLabel={product.images[0]?.alt ?? product.name}
        />
        {off >= 5 ? (
          <View style={styles.ribbon}>
            <Text variant="micro" style={styles.ribbonText}>
              {off}%{'\n'}OFF
            </Text>
          </View>
        ) : null}
        <View style={styles.heart}>
          <WishlistButton productId={product.id} variantId={product.variantId} size={15} />
        </View>
        <View style={styles.add}>
          <AddToCartButton product={product} />
        </View>
      </View>

      <View style={styles.body}>
        {product.deliveryLabel ? (
          <View style={styles.eta}>
            <Text variant="micro" tone="mutedForeground">
              {product.deliveryLabel}
            </Text>
          </View>
        ) : null}
        <Text variant="captionStrong" numberOfLines={2} style={styles.title}>
          {product.name}
        </Text>
        {product.variantLabel ? (
          <Text variant="caption" tone="mutedForeground" numberOfLines={1}>
            {product.variantLabel}
          </Text>
        ) : null}
        {product.ratingCount > 0 ? (
          <View style={styles.rating}>
            <Star size={11} color={styles.ratingStar.color} fill={styles.ratingStar.color} />
            <Text variant="micro">{formatRating(product.rating)}</Text>
            <Text variant="micro" tone="mutedForeground">
              ({formatCompact(product.ratingCount)})
            </Text>
          </View>
        ) : null}
        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} size="sm" showDiscount={false} />
      </View>
    </PressableScale>
  );
});

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    fill: { flex: 1 },
    media: { aspectRatio: 1, backgroundColor: colors.muted },
    image: { width: '100%', height: '100%' },
    ribbon: {
      position: 'absolute',
      top: 0,
      left: 8,
      backgroundColor: colors.sale,
      paddingHorizontal: 5,
      paddingTop: 3,
      paddingBottom: 5,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },
    ribbonText: { color: colors.saleForeground, textAlign: 'center', lineHeight: 11 },
    heart: { position: 'absolute', top: 6, right: 6 },
    add: { position: 'absolute', right: 6, bottom: -14 },
    body: { padding: 8, paddingTop: 18, gap: 3 },
    eta: {
      alignSelf: 'flex-start',
      backgroundColor: colors.muted,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    title: { minHeight: 32 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingStar: { color: colors.rating },
  });
