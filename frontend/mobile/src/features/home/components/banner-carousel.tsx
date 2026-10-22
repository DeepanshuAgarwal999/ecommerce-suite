import { memo, useCallback, useEffect, useRef } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { ArrowRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { resolveCmsLink } from '@/lib/links';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';
import type { BannerSlide } from '../banner-slides';

const AUTOPLAY_MS = 4500;
const PEEK = 0; // full-width cards; set >0 to show the next slide's edge
const ASPECT = 0.5; // height / width

interface BannerCarouselProps {
  slides: BannerSlide[];
}

/**
 * Hero carousel. Paging, parallax and the stretching pagination dots are all
 * driven from one scroll shared value on the UI thread. Autoplay pauses while
 * the shopper's finger is down and while the screen is not focused, and resumes
 * from wherever they left it.
 */
export const BannerCarousel = memo(function BannerCarousel({ slides }: BannerCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - GUTTER * 2 - PEEK;
  const snap = cardWidth + GUTTER / 2;
  const height = Math.round(cardWidth * ASPECT);

  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const dragging = useRef(false);
  const index = useRef(0);
  const focused = useIsFocused();

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    if (!focused || slides.length < 2) return;
    const id = setInterval(() => {
      if (dragging.current) return;
      index.current = (index.current + 1) % slides.length;
      const x = index.current * snap;
      scheduleOnUI(() => {
        'worklet';
        scrollTo(ref, x, 0, true);
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [focused, slides.length, snap, ref]);

  const onMomentumEnd = useCallback(
    (x: number) => {
      index.current = Math.round(x / snap);
      dragging.current = false;
    },
    [snap],
  );

  return (
    <View>
      <Animated.ScrollView
        ref={ref}
        horizontal
        decelerationRate="fast"
        snapToInterval={snap}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => (dragging.current = true)}
        onMomentumScrollEnd={(event) => onMomentumEnd(event.nativeEvent.contentOffset.x)}
      >
        {slides.map((slide, i) => (
          <BannerCard key={slide.id} slide={slide} index={i} width={cardWidth} height={height} snap={snap} offset={offset} />
        ))}
      </Animated.ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {slides.map((slide, i) => (
            <Dot key={slide.id} index={i} snap={snap} offset={offset} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

interface BannerCardProps {
  slide: BannerSlide;
  index: number;
  width: number;
  height: number;
  snap: number;
  offset: SharedValue<number>;
}

const BannerCard = memo(function BannerCard({ slide, index, width, height, snap, offset }: BannerCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  // The photo drifts at a fraction of the swipe speed - a subtle depth cue.
  const parallax = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(offset.value, [(index - 1) * snap, index * snap, (index + 1) * snap], [-40, 0, 40], Extrapolation.CLAMP),
      },
      { scale: 1.15 },
    ],
  }));

  const open = () => {
    const href = resolveCmsLink(slide.linkUrl);
    if (href) router.push(href);
    else if (/^https?:\/\//.test(slide.linkUrl)) void Linking.openURL(slide.linkUrl);
  };

  return (
    <PressableScale
      onPress={open}
      activeScale={0.98}
      style={[styles.card, { width, height, backgroundColor: colors.brandDark }]}
      accessibilityRole="link"
      accessibilityLabel={`${slide.headline}. ${slide.ctaLabel}`}
    >
      {slide.imageUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
          <Image
            source={slide.imageUrl}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            priority={index === 0 ? 'high' : 'normal'}
            cachePolicy="memory-disk"
            accessibilityLabel={slide.imageAlt}
          />
        </Animated.View>
      ) : (
        <LinearGradient colors={[colors.brandDark, colors.primary, colors.highlight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}

      {/* Legibility scrim for copy over a photo. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.15)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.copy}>
        {slide.eyebrow ? (
          <View style={[styles.eyebrow, { backgroundColor: colors.promo }]}>
            <Text variant="micro" style={{ color: colors.promoForeground }}>
              {slide.eyebrow.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text variant="title" numberOfLines={2} style={styles.headline}>
          {slide.headline}
        </Text>
        {slide.subcopy ? (
          <Text variant="caption" numberOfLines={2} style={styles.subcopy}>
            {slide.subcopy}
          </Text>
        ) : null}
        <View style={styles.cta}>
          <Text variant="captionStrong" style={{ color: colors.foreground }}>
            {slide.ctaLabel}
          </Text>
          <ArrowRight size={14} color={colors.foreground} strokeWidth={2.6} />
        </View>
      </View>
    </PressableScale>
  );
});

const Dot = memo(function Dot({ index, snap, offset }: { index: number; snap: number; offset: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const progress = interpolate(offset.value, [(index - 1) * snap, index * snap, (index + 1) * snap], [0, 1, 0], Extrapolation.CLAMP);
    return {
      width: 6 + progress * 16,
      opacity: 0.35 + progress * 0.65,
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, style]} />;
});

export function BannerCarouselSkeleton() {
  const { width } = useWindowDimensions();
  const cardWidth = width - GUTTER * 2;
  return (
    <View style={styles.track}>
      <Skeleton width={cardWidth} height={Math.round(cardWidth * ASPECT)} radius={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: GUTTER, gap: GUTTER / 2 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  copy: { flex: 1, justifyContent: 'center', padding: 18, gap: 6, maxWidth: '72%' },
  eyebrow: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  headline: { color: '#fff' },
  subcopy: { color: 'rgba(255,255,255,0.88)' },
  cta: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
});
