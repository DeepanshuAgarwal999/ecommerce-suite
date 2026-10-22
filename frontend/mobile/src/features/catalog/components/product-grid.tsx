import { memo, useCallback, type ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER } from '@/theme/tokens';
import type { Product } from '../types';
import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-rail';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  fetchingMore: boolean;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  bottomInset?: number;
}

const GAP = 10;

/**
 * Two-column infinite product grid on FlashList. Pagination kicks in half a
 * screen before the end so the next page is usually there before the shopper
 * reaches it.
 */
export const ProductGrid = memo(function ProductGrid({
  products,
  loading,
  fetchingMore,
  onEndReached,
  onRefresh,
  refreshing = false,
  header,
  empty,
  bottomInset = 0,
}: ProductGridProps) {
  const { colors } = useTheme();

  const renderItem = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <View style={styles.cell}>
        <ProductCard product={item} />
      </View>
    ),
    [],
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.skeleton}>
        {header}
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonCell}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlashList
      data={products}
      numColumns={2}
      renderItem={renderItem}
      keyExtractor={keyOf}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={fetchingMore ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
      contentContainerStyle={{ paddingHorizontal: GUTTER - GAP / 2, paddingBottom: bottomInset + 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    />
  );
});

const keyOf = (product: Product) => product.id;

const styles = StyleSheet.create({
  cell: { padding: GAP / 2 },
  footer: { paddingVertical: 20 },
  skeleton: { flex: 1 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, gap: GAP, paddingTop: 12 },
  skeletonCell: { width: '48.4%' },
});
