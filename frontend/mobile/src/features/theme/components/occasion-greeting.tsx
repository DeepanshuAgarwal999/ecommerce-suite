import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius, type OccasionKey } from '@/theme/tokens';
import { HangingDiya } from './diya';

/** Greeting copy per occasion - mirrors the web OccasionStrip `copy` map. */
const COPY: Partial<Record<OccasionKey, { greeting: string; line: string }>> = {
  diwali: { greeting: 'Happy Diwali', line: 'Light up every corner - festive picks, up to 70% off' },
  navratri: { greeting: 'Shubh Navratri', line: 'Nine nights, nine looks for your home' },
  holi: { greeting: 'Happy Holi', line: 'Splash colour across every room' },
  rakhi: { greeting: 'Happy Raksha Bandhan', line: 'Gifts they will keep for years' },
  independence: { greeting: 'Happy Independence Day', line: 'Celebrate the makers of India' },
  eid: { greeting: 'Eid Mubarak', line: 'Hosting essentials for the feast' },
  christmas: { greeting: 'Merry Christmas', line: 'Deck the halls, softly' },
};

/**
 * The festive greeting card atop the home screen. Renders only while an
 * occasion theme is live (light mode) - it is driven by the same StoreTheme the
 * admin console switches on, so a festival re-skins the app with no release.
 */
export const OccasionGreeting = memo(function OccasionGreeting() {
  const { colors, occasion, storeTheme } = useTheme();
  if (!occasion) return null;
  const copy = COPY[occasion];
  if (!copy) return null;

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.wrap}>
      <LinearGradient
        colors={[colors.festive, colors.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {occasion === 'diwali' ? (
          <View style={styles.diyas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <HangingDiya size={30} rope={10} delay={0} />
            <HangingDiya size={36} rope={24} delay={350} />
            <HangingDiya size={30} rope={14} delay={700} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text variant="display" style={{ color: colors.festiveGold }}>
            {copy.greeting}
          </Text>
          <Text variant="caption" style={styles.line}>
            {storeTheme?.announcement || copy.line}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER },
  card: { borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', minHeight: 96, paddingRight: 16 },
  diyas: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingLeft: 10, alignSelf: 'flex-start' },
  copy: { flex: 1, paddingVertical: 16, paddingLeft: 14, gap: 4 },
  line: { color: 'rgba(255,255,255,0.88)' },
});
