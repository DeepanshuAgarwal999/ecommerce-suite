import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { usePreferencesStore } from '@/store/preferences-store';

/**
 * Haptic vocabulary for the whole app, so the same gesture always feels the
 * same. Respects the shopper's setting and never throws (some Android devices
 * have no vibrator).
 */
function run(effect: () => Promise<void>): void {
  if (Platform.OS === 'web' || !usePreferencesStore.getState().haptics) return;
  effect().catch(() => undefined);
}

export const haptic = {
  /** Tabs, chips, toggles. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Add to cart, stepper. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
