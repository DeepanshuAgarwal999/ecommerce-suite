import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/common/section-header';
import { TAB_BAR_HEIGHT } from '@/components/navigation/tab-bar';
import { ProductRail } from '@/features/catalog/components/product-rail';
import { useProducts } from '@/features/catalog/hooks';
import { BannerCarousel, BannerCarouselSkeleton } from '@/features/home/components/banner-carousel';
import { CategoryGrid } from '@/features/home/components/category-grid';
import { CmsSections } from '@/features/home/components/cms-sections';
import { HEADER_COLLAPSE, HEADER_PINNED, HomeHeader } from '@/features/home/components/home-header';
import { UspStrip } from '@/features/home/components/usp-strip';
import { useBanners } from '@/features/home/api';
import { fallbackSlides, toBannerSlide } from '@/features/home/banner-slides';
import { ForYou } from '@/features/recommendations/components/for-you';
import { OccasionGreeting } from '@/features/theme/components/occasion-greeting';
import { useStagedMount } from '@/lib/hooks/use-staged-mount';
import { useTheme } from '@/theme/theme-provider';

/**
 * Home: the same composition as the web home page (frontend/web app/(shop)/page.tsx)
 * re-laid for a phone - greeting, hero, USPs, categories, bestsellers, for-you,
 * admin shelves, new arrivals.
 *
 * Every block fetches its own data and ships its own skeleton, so a slow or
 * failing service blanks one block, never the screen.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const scrollY = useSharedValue(0);
  const stage = useStagedMount(3);
  const [refreshing, setRefreshing] = useState(false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: 'active' });
    setRefreshing(false);
  }, [queryClient]);

  const headerHeight = insets.top + HEADER_COLLAPSE + HEADER_PINNED;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <HomeHeader scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerHeight + 14, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerHeight} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.stack}>
          <OccasionGreeting />
          <Hero />
          <UspStrip />
          <CategoryGrid />
          {stage >= 1 ? <SortedRail title="Bestsellers" subtitle="What everyone is adding this week" sort="rating" /> : null}
          {stage >= 2 ? <ForYou /> : null}
          {stage >= 2 ? <CmsSections /> : null}
          {stage >= 3 ? <SortedRail title="New arrivals" subtitle="Fresh from the makers" sort="newest" /> : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Hero() {
  const { data, isLoading } = useBanners();
  if (isLoading) return <BannerCarouselSkeleton />;
  // Never blank: an empty or failed CMS read falls back to the built-in slides.
  const slides = data && data.length > 0 ? data.map(toBannerSlide) : fallbackSlides;
  return <BannerCarousel slides={slides} />;
}

function SortedRail({ title, subtitle, sort }: { title: string; subtitle: string; sort: 'rating' | 'newest' }) {
  const router = useRouter();
  const { data, isLoading, isError } = useProducts({ sort, pageSize: 12 });
  if (isError || (!isLoading && (!data || data.length === 0))) return null;
  return (
    <View>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        onSeeAll={() => router.push({ pathname: '/category/[slug]', params: { slug: 'all', sort } })}
      />
      <ProductRail products={data} loading={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: 26 },
});
