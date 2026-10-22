import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SectionHeader } from '@/components/common/section-header';
import { useCategories } from '@/features/catalog/hooks';
import type { Category } from '@/features/catalog/types';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const COLUMNS = 4;
const GAP = 10;
const MAX_TILES = 8;

/** Soft tile backgrounds that rotate, so a grid of white-background product shots doesn't read as one slab. */
const TILE_TINTS = ['#f3e8ff', '#fde7f3', '#fff1d6', '#e3f6ea', '#e6f0ff', '#ffe9e3', '#eef2e3', '#f1eaf7'];

/** "Shop by category" - the Blinkit-style 4-up grid. */
export const CategoryGrid = memo(function CategoryGrid() {
  const { data, isLoading } = useCategories();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tile = (width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  if (isLoading) return <CategoryGridSkeleton tile={tile} />;
  if (!data || data.length === 0) return null;

  const categories = data.slice(0, MAX_TILES);

  return (
    <View>
      <SectionHeader
        title="Shop by category"
        onSeeAll={data.length > MAX_TILES ? () => router.push('/categories') : undefined}
      />
      <View style={styles.grid}>
        {categories.map((category, index) => (
          <CategoryTile key={category.id} category={category} index={index} size={tile} />
        ))}
      </View>
    </View>
  );
});

const CategoryTile = memo(function CategoryTile({ category, index, size }: { category: Category; index: number; size: number }) {
  const router = useRouter();
  const { isDark, colors } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(320)} style={{ width: size }}>
      <PressableScale
        activeScale={0.92}
        haptics="selection"
        onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })}
        accessibilityLabel={category.name}
        style={styles.tile}
      >
        <View
          style={[
            styles.imageWrap,
            { width: size, height: size, backgroundColor: isDark ? colors.secondary : TILE_TINTS[index % TILE_TINTS.length] },
          ]}
        >
          <Image source={category.imageUrl} style={styles.image} contentFit="contain" transition={200} cachePolicy="memory-disk" />
        </View>
        <Text variant="captionStrong" numberOfLines={2} align="center" style={styles.label}>
          {category.name}
        </Text>
      </PressableScale>
    </Animated.View>
  );
});

function CategoryGridSkeleton({ tile }: { tile: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: MAX_TILES }, (_, index) => (
        <View key={index} style={{ width: tile, gap: 6, alignItems: 'center' }}>
          <Skeleton width={tile} height={tile} radius={radius.md} />
          <Skeleton width={tile * 0.7} height={10} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, gap: GAP, rowGap: 14 },
  tile: { alignItems: 'center', gap: 6 },
  imageWrap: { borderRadius: radius.md, overflow: 'hidden', padding: 8 },
  image: { width: '100%', height: '100%' },
  label: { lineHeight: 15 },
});
