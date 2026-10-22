import { memo, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Clock } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/section-header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { ProductCard } from '@/features/catalog/components/product-card';
import { ProductCardSkeleton, ProductRail } from '@/features/catalog/components/product-rail';
import { useProducts } from '@/features/catalog/hooks';
import type { ProductSort } from '@/features/catalog/types';
import { resolveCmsLink } from '@/lib/links';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';
import { useHomeSections } from '../api';
import type { CmsHomeSection, CmsSectionConfig, CmsSectionTile } from '../cms-types';

/**
 * Admin-curated shelves, in the order set in the console, each rendered by its
 * `layout` - the native counterpart of the web's features/home/components/
 * sections. An unknown layout renders nothing, so a newer console never crashes
 * an older app build.
 */
export const CmsSections = memo(function CmsSections() {
  const { data } = useHomeSections();
  if (!data || data.length === 0) return null;
  return (
    <View style={styles.stack}>
      {data.map((section) => (
        <CmsSection key={section.id} section={section} />
      ))}
    </View>
  );
});

function CmsSection({ section }: { section: CmsHomeSection }) {
  switch (section.layout) {
    case 'TILE_GRID':
      return <TileGridSection section={section} />;
    case 'SPLIT_BANNERS':
      return <SplitBannersSection section={section} />;
    case 'PRODUCT_GRID':
      return <ProductGridSection section={section} />;
    case 'PRODUCT_TABS':
      return <ProductTabsSection section={section} />;
    case 'DEAL_OF_DAY':
      return <DealOfDaySection section={section} />;
    default:
      return null;
  }
}

function useOpenLink() {
  const router = useRouter();
  return (url: string | null | undefined) => {
    const href = resolveCmsLink(url);
    if (href) router.push(href);
    else if (url && /^https?:\/\//.test(url)) void Linking.openURL(url);
  };
}

function SectionFrame({ section, children }: { section: CmsHomeSection; children: React.ReactNode }) {
  const { colors } = useTheme();
  const open = useOpenLink();
  const tone = section.config?.tone ?? 'plain';
  const festive = Boolean(section.themeId) || tone === 'festive';
  const viewAll = section.config?.viewAllUrl;

  return (
    <View style={tone !== 'plain' && [styles.wash, { backgroundColor: festive ? colors.festiveWash : colors.secondary }]}>
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        festive={festive}
        onSeeAll={viewAll ? () => open(viewAll) : undefined}
      />
      {children}
    </View>
  );
}

const sortOf = (config: CmsSectionConfig | null): ProductSort => config?.sort ?? 'popular';

/* ---------------- TILE_GRID ---------------- */

function TileGridSection({ section }: { section: CmsHomeSection }) {
  const { width } = useWindowDimensions();
  const open = useOpenLink();
  const { colors } = useTheme();
  const shape = section.config?.tileShape ?? 'square';
  const columns = section.tiles.length <= 4 ? 2 : 3;
  const gap = 10;
  const size = (width - GUTTER * 2 - gap * (columns - 1)) / columns;
  const tileRadius = shape === 'circle' ? size / 2 : radius.md;

  return (
    <SectionFrame section={section}>
      <View style={[styles.grid, { gap }]}>
        {section.tiles.map((tile, index) => (
          <Animated.View key={tile.id} entering={FadeInDown.delay(index * 50).duration(320)} style={{ width: size }}>
            <PressableScale onPress={() => open(tile.linkUrl)} activeScale={0.95} accessibilityLabel={tile.title} style={styles.tile}>
              <View
                style={[
                  styles.tileImage,
                  { width: size, height: shape === 'arch' ? size * 1.25 : size, borderRadius: tileRadius, backgroundColor: colors.muted },
                  shape === 'arch' && { borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2 },
                ]}
              >
                <Image source={tile.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={tile.imageAlt} />
              </View>
              <Text variant="captionStrong" align="center" numberOfLines={2}>
                {tile.title}
              </Text>
              {tile.subtitle ? (
                <Text variant="micro" tone="mutedForeground" align="center" numberOfLines={1}>
                  {tile.subtitle}
                </Text>
              ) : null}
            </PressableScale>
          </Animated.View>
        ))}
      </View>
    </SectionFrame>
  );
}

/* ---------------- SPLIT_BANNERS ---------------- */

function SplitBannersSection({ section }: { section: CmsHomeSection }) {
  const { width } = useWindowDimensions();
  const open = useOpenLink();
  const cardWidth = Math.min(width * 0.72, 320);

  return (
    <SectionFrame section={section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 10}
        decelerationRate="fast"
        contentContainerStyle={styles.hTrack}
      >
        {section.tiles.map((tile) => (
          <SplitBanner key={tile.id} tile={tile} width={cardWidth} onPress={() => open(tile.linkUrl)} />
        ))}
      </ScrollView>
    </SectionFrame>
  );
}

function SplitBanner({ tile, width, onPress }: { tile: CmsSectionTile; width: number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.97} style={[styles.split, { width, height: width * 0.62 }]} accessibilityLabel={tile.title}>
      <Image source={tile.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} accessibilityLabel={tile.imageAlt} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
      <View style={styles.splitCopy}>
        <Text variant="heading" style={styles.onImage} numberOfLines={1}>
          {tile.title}
        </Text>
        {tile.subtitle ? (
          <Text variant="caption" style={styles.onImageMuted} numberOfLines={1}>
            {tile.subtitle}
          </Text>
        ) : null}
        {tile.ctaLabel ? (
          <Text variant="captionStrong" style={styles.onImage}>
            {tile.ctaLabel} ›
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/* ---------------- PRODUCT_GRID ---------------- */

function ProductGridSection({ section }: { section: CmsHomeSection }) {
  const { data, isLoading } = useProducts({
    categoryId: section.config?.categoryId,
    sort: sortOf(section.config),
    pageSize: section.config?.limit ?? 6,
  });
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <SectionFrame section={section}>
      <View style={styles.productGrid}>
        {isLoading
          ? [0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.gridCell}>
                <ProductCardSkeleton />
              </View>
            ))
          : data!.map((product, index) => (
              <Animated.View key={product.id} entering={FadeInDown.delay((index % 4) * 50).duration(300)} style={styles.gridCell}>
                <ProductCard product={product} />
              </Animated.View>
            ))}
      </View>
    </SectionFrame>
  );
}

/* ---------------- PRODUCT_TABS ---------------- */

function ProductTabsSection({ section }: { section: CmsHomeSection }) {
  const { colors } = useTheme();
  const tabs = section.tiles.filter((tile) => tile.categoryId);
  const [active, setActive] = useState(0);
  const current = tabs[active];

  const { data, isLoading } = useProducts(
    { categoryId: current?.categoryId ?? undefined, sort: sortOf(section.config), pageSize: section.config?.limit ?? 10 },
    Boolean(current),
  );

  if (tabs.length === 0) return null;

  return (
    <SectionFrame section={section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <PressableScale
              key={tab.id}
              onPress={() => {
                haptic.selection();
                setActive(index);
              }}
              activeScale={0.94}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.tab,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
              ]}
            >
              <Text variant="captionStrong" style={{ color: selected ? colors.primaryForeground : colors.foreground }}>
                {tab.title}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      <Animated.View key={current?.id} entering={FadeIn.duration(220)} layout={LinearTransition}>
        <ProductRail products={data} loading={isLoading} />
      </Animated.View>
    </SectionFrame>
  );
}

/* ---------------- DEAL_OF_DAY ---------------- */

function DealOfDaySection({ section }: { section: CmsHomeSection }) {
  const { colors } = useTheme();
  const endsAt = section.config?.countdownEndsAt;
  const [expired, setExpired] = useState(() => (endsAt ? new Date(endsAt).getTime() <= Date.now() : false));
  const { data, isLoading } = useProducts({
    categoryId: section.config?.categoryId,
    sort: sortOf(section.config),
    pageSize: section.config?.limit ?? 10,
  });

  // An expired deal disappears rather than advertising a price that's gone.
  if (expired) return null;

  return (
    <View style={[styles.deal, { backgroundColor: colors.festiveWash }]}>
      <View style={styles.dealHeader}>
        <View style={styles.dealTitle}>
          <Text variant="heading" style={{ color: colors.festive }}>
            {section.title}
          </Text>
          {section.subtitle ? (
            <Text variant="caption" tone="mutedForeground">
              {section.subtitle}
            </Text>
          ) : null}
        </View>
        {endsAt ? <CountdownPill endsAt={endsAt} onExpire={() => setExpired(true)} /> : null}
      </View>
      <ProductRail products={data} loading={isLoading} />
    </View>
  );
}

/**
 * Owns the 1 s tick, so only this pill re-renders each second - not the deal's
 * product rail.
 */
const CountdownPill = memo(function CountdownPill({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const { colors } = useTheme();
  const target = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, target - now);
  useEffect(() => {
    if (ms === 0) onExpire();
  }, [ms, onExpire]);

  const total = Math.floor(ms / 1000);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((part) => String(part).padStart(2, '0'));
  return (
    <View style={[styles.countdown, { backgroundColor: colors.festive }]} accessibilityLabel={`Ends in ${parts[0]} hours ${parts[1]} minutes`}>
      <Clock size={13} color={colors.festiveGold} strokeWidth={2.6} />
      <Text variant="captionStrong" tabular style={{ color: colors.festiveForeground }}>
        {parts.join(':')}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  stack: { gap: 28 },
  wash: { paddingVertical: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, rowGap: 16 },
  tile: { alignItems: 'center', gap: 6 },
  tileImage: { overflow: 'hidden' },
  hTrack: { paddingHorizontal: GUTTER, gap: 10 },
  split: { borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  splitCopy: { padding: 14, gap: 2 },
  onImage: { color: '#fff' },
  onImageMuted: { color: 'rgba(255,255,255,0.85)' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, gap: 10 },
  gridCell: { width: '48.5%' },
  tabs: { paddingHorizontal: GUTTER, gap: 8, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  deal: { paddingVertical: 18, gap: 12 },
  dealHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, gap: 12 },
  dealTitle: { flex: 1, gap: 2 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
});
