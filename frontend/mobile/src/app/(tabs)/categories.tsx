import { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutGrid } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { TAB_BAR_HEIGHT } from '@/components/navigation/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ProductCard } from '@/features/catalog/components/product-card';
import { ProductCardSkeleton } from '@/features/catalog/components/product-rail';
import { useCategories, useProducts } from '@/features/catalog/hooks';
import type { Category } from '@/features/catalog/types';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { radius, springs } from '@/theme/tokens';

const RAIL_WIDTH = 88;
const RAIL_ITEM = 92;

/**
 * Blinkit-style category browser: a vertical rail of top-level categories with a
 * sliding selection marker, and the selected category's sub-categories (or its
 * products, when it has none) on the right.
 */
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useCategories();
  const [selected, setSelected] = useState(0);
  const marker = useSharedValue(0);

  const select = useCallback(
    (index: number) => {
      haptic.selection();
      setSelected(index);
      marker.set(withSpring(index * RAIL_ITEM, springs.sheet));
    },
    [marker],
  );

  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: marker.value }] }));
  const current = data?.[selected];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="All categories" back={false} search />
      {isError ? (
        <EmptyState
          icon={<LayoutGrid size={36} color={colors.primary} />}
          title="Couldn't load categories"
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      ) : (
        <View style={styles.body}>
          <ScrollView
            style={[styles.rail, { backgroundColor: colors.muted }]}
            contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {isLoading
              ? Array.from({ length: 7 }, (_, index) => (
                  <View key={index} style={styles.railItem}>
                    <Skeleton width={52} height={52} radius={26} />
                    <Skeleton width={56} height={10} />
                  </View>
                ))
              : null}
            {data ? (
              <Animated.View style={[styles.marker, { backgroundColor: colors.card }, markerStyle]}>
                <View style={[styles.markerBar, { backgroundColor: colors.primary }]} />
              </Animated.View>
            ) : null}
            {data?.map((category, index) => (
              <RailItem key={category.id} category={category} active={index === selected} onPress={() => select(index)} />
            ))}
          </ScrollView>

          <View style={styles.panel}>{current ? <CategoryPanel key={current.id} category={current} /> : null}</View>
        </View>
      )}
    </View>
  );
}

const RailItem = memo(function RailItem({ category, active, onPress }: { category: Category; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.92}
      style={styles.railItem}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={category.name}
    >
      <View style={[styles.railImage, { backgroundColor: active ? colors.secondary : colors.card }]}>
        <Image source={category.imageUrl} style={styles.fill} contentFit="contain" cachePolicy="memory-disk" />
      </View>
      <Text variant="micro" align="center" numberOfLines={2} style={{ color: active ? colors.primary : colors.mutedForeground }}>
        {category.name}
      </Text>
    </PressableScale>
  );
});

function CategoryPanel({ category }: { category: Category }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const children = category.children ?? [];
  const products = useProducts({ categoryId: category.id, sort: 'popular', pageSize: 12 }, children.length === 0);

  return (
    <Animated.ScrollView
      entering={FadeIn.duration(220)}
      contentContainerStyle={[styles.panelContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 96 }]}
      showsVerticalScrollIndicator={false}
    >
      <PressableScale
        onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })}
        activeScale={0.98}
        style={[styles.banner, { backgroundColor: colors.secondary }]}
      >
        <View style={styles.bannerCopy}>
          <Text variant="heading">{category.name}</Text>
          <Text variant="caption" tone="mutedForeground">
            {category.productCount > 0 ? `${category.productCount} products · ` : ''}See all ›
          </Text>
        </View>
        <Image source={category.imageUrl} style={styles.bannerImage} contentFit="contain" />
      </PressableScale>

      {children.length > 0 ? (
        <View style={styles.childGrid}>
          {children.map((child) => (
            <PressableScale
              key={child.id}
              activeScale={0.93}
              onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: child.slug } })}
              style={styles.child}
              accessibilityLabel={child.name}
            >
              <View style={[styles.childImage, { backgroundColor: colors.muted }]}>
                <Image source={child.imageUrl} style={styles.fill} contentFit="contain" transition={180} />
              </View>
              <Text variant="micro" align="center" numberOfLines={2}>
                {child.name}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        <View style={styles.productGrid}>
          {products.isLoading
            ? [0, 1, 2, 3].map((index) => (
                <View key={index} style={styles.productCell}>
                  <ProductCardSkeleton />
                </View>
              ))
            : products.data?.map((product) => (
                <View key={product.id} style={styles.productCell}>
                  <ProductCard product={product} />
                </View>
              ))}
        </View>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  rail: { width: RAIL_WIDTH, flexGrow: 0 },
  railItem: { height: RAIL_ITEM, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  railImage: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', padding: 6 },
  marker: { position: 'absolute', left: 0, right: 0, height: RAIL_ITEM },
  markerBar: { position: 'absolute', right: 0, top: 14, bottom: 14, width: 4, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  fill: { width: '100%', height: '100%' },
  panel: { flex: 1 },
  panelContent: { padding: 12, gap: 14 },
  banner: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 90 },
  bannerCopy: { flex: 1, gap: 4 },
  bannerImage: { width: 72, height: 72 },
  childGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  child: { width: '30.5%', alignItems: 'center', gap: 6 },
  childImage: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', padding: 6 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCell: { width: '47.5%' },
});
