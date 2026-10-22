import { StyleSheet } from 'react-native';
import { useNetworkState } from 'expo-network';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { Text } from '@/components/ui/text';

/** Slides down under the status bar when the device loses connectivity. */
export function OfflineBanner() {
  const network = useNetworkState();
  const insets = useSafeAreaInsets();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp}
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <WifiOff size={14} color="#fff" />
      <Text variant="captionStrong" style={styles.text}>
        You’re offline - showing saved results
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#3a2f39',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  text: { color: '#fff' },
});
