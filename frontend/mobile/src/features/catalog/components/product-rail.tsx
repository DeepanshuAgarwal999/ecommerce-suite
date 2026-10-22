import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Skeleton } from '@/components/ui/skeleton';
import { GUTTER } from '@/theme/tokens';
import type { Product } from '../types';
import { ProductCard } from './product-card';

export const RAIL_CARD_WIDTH = 138;
const GAP = 10;

interface ProductRailProps {
  products: Product[] | undefined;
  loading?: boolean;
  onViewableChange?: (productIds: string[]) => void;
}

/**
 * Horizontal product shelf. FlashList recycles card views, so a 20-item rail
 * keeps only the visible handful mounted - the home screen can stack many rails
 * without the memory and mount cost of rendering every card.
 */
export const ProductRail = memo(function ProductRail({ products, loading, onViewableChange }: ProductRailProps) {
  const renderItem = useCallback<ListRenderItem<Product>>(
    ({ item }) => <ProductCard product={item} width={RAIL_CARD_WIDTH} />,
    [],
  );

  if (loading && !products) return <ProductRailSkeleton />;
  if (!products || products.length === 0) return null;

  return (
    <FlashList
      horizontal
      data={products}
      renderItem={renderItem}
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      onViewableItemsChanged={
        onViewableChange
          ? ({ viewableItems }) => onViewableChange(viewableItems.map((token) => (token.item as Product).id))
          : undefined
      }
    />
  );
});

const keyOf = (product: Product) => product.id;
const Gap = () => <View style={{ width: GAP }} />;

export function ProductRailSkeleton() {
  return (
    <View style={[styles.content, styles.skeletonRow]}>
      {[0, 1, 2].map((index) => (
        <ProductCardSkeleton key={index} width={RAIL_CARD_WIDTH} />
      ))}
    </View>
  );
}

export function ProductCardSkeleton({ width }: { width?: number }) {
  return (
    <View style={[styles.skeletonCard, width ? { width } : { flex: 1 }]}>
      <Skeleton height={width ?? 160} radius={12} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="60%" height={12} />
      <Skeleton width="40%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 4 },
  skeletonRow: { flexDirection: 'row', gap: GAP },
  skeletonCard: { gap: 8 },
});
