import { memo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import type { ProductImage } from '../types';

interface ImageGalleryProps {
  images: ProductImage[];
  /** Vertical scroll of the screen - drives the stretch-on-overscroll and parallax. */
  scrollY: SharedValue<number>;
}

/**
 * Full-bleed product gallery: horizontal paging, a "2 / 5" counter, stretching
 * dots, and a stretchy zoom when the screen is pulled down (iOS overscroll).
 */
export const ImageGallery = memo(function ImageGallery({ images, scrollY }: ImageGalleryProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const offset = useSharedValue(0);
  const [page, setPage] = useState(0);
  const height = width;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.x;
    },
  });

  const stretch = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-height, 0, height], [-height / 2, 0, height * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-height, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));

  const list = images.length > 0 ? images : [{ url: '', alt: '' }];

  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: colors.muted }}>
      <Animated.View style={[{ width, height }, stretch]}>
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
        >
          {list.map((image, index) => (
            <Image
              key={`${image.url}-${index}`}
              source={image.url || undefined}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
              priority={index === 0 ? 'high' : 'low'}
              cachePolicy="memory-disk"
              accessibilityLabel={image.alt}
            />
          ))}
        </Animated.ScrollView>
      </Animated.View>

      {list.length > 1 ? (
        <>
          <View style={[styles.counter, { backgroundColor: colors.overlay }]}>
            <Text variant="micro" style={styles.counterText}>
              {page + 1} / {list.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {list.map((_, index) => (
              <Dot key={index} index={index} width={width} offset={offset} color={colors.primary} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
});

function Dot({ index, width, offset, color }: { index: number; width: number; offset: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const progress = interpolate(offset.value, [(index - 1) * width, index * width, (index + 1) * width], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 6 + progress * 12, opacity: 0.4 + progress * 0.6 };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  counter: { position: 'absolute', right: 12, bottom: 14, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  counterText: { color: '#fff' },
  dots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  dot: { height: 6, borderRadius: 3 },
});
