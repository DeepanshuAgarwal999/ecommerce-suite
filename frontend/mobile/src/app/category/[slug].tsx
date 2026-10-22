import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackageSearch } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FloatingCartBar } from '@/features/cart/components/floating-cart-bar';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import { SortChips } from '@/features/catalog/components/sort-chips';
import { useCategory, useProductFeed } from '@/features/catalog/hooks';
import type { ProductSort } from '@/features/catalog/types';
import { useTheme } from '@/theme/theme-provider';

/**
 * Category listing. `slug=all` lists the whole catalogue (the home rails' "See
 * all"), otherwise the slug is resolved to a category id first - same as the
 * web's /c/[slug] page.
 */
export default function CategoryScreen() {
  const { slug, sort: initialSort } = useLocalSearchParams<{ slug: string; sort?: ProductSort }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<ProductSort>(initialSort ?? 'popular');
  const isAll = slug === 'all';

  const category = useCategory(isAll ? '' : slug);
  const ready = isAll || Boolean(category.data?.id);

  const feed = useProductFeed({ categoryId: isAll ? undefined : category.data?.id, sort, pageSize: 20 }, ready);
  const products = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const total = feed.data?.pages[0]?.meta.total;

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  const title = isAll ? 'All products' : (category.data?.name ?? 'Loading…');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title} subtitle={total !== undefined ? `${total} items` : undefined} search />
      <ProductGrid
        products={products}
        loading={(!ready && !category.isError) || feed.isLoading}
        fetchingMore={feed.isFetchingNextPage}
        onEndReached={onEndReached}
        onRefresh={() => void feed.refetch()}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        header={<SortChips value={sort} onChange={setSort} />}
        bottomInset={insets.bottom + 80}
        empty={
          category.isError || (!feed.isLoading && products.length === 0) ? (
            <EmptyState
              icon={<PackageSearch size={36} color={colors.primary} />}
              title={category.isError ? 'Category not found' : 'Nothing here yet'}
              description="New pieces land every Friday. Try another category in the meantime."
            />
          ) : null
        }
      />
      <FloatingCartBar bottom={insets.bottom + 12} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
