import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutUp } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';

/** What the search pill cycles through - the web's animated-placeholder terms. */
export const SEARCH_HINTS = ['bedsheets', 'cushion covers', 'wall clocks', 'dinner sets', 'table lamps', 'planters', 'bath towels', 'rugs'];

/**
 * "Search for 'bedsheets'" with the quoted term rolling upward every 2.4 s, like
 * Zepto/Blinkit. Only the term animates (layout-stable), and it pauses when the
 * header isn't visible so it costs nothing off-screen.
 */
export const AnimatedPlaceholder = memo(function AnimatedPlaceholder({ paused }: { paused?: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((value) => (value + 1) % SEARCH_HINTS.length), 2400);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <View style={styles.row} accessibilityLabel="Search products">
      <Text tone="mutedForeground">Search for </Text>
      <View style={styles.window}>
        <Animated.View key={index} entering={SlideInDown.duration(320)} exiting={SlideOutUp.duration(320)}>
          <Text variant="bodyStrong" tone="mutedForeground">
            “{SEARCH_HINTS[index]}”
          </Text>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  window: { height: 20, overflow: 'hidden', flex: 1 },
});
