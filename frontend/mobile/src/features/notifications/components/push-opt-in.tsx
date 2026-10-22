import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { BellRing } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { getPushPermission, PUSH_SUPPORTED, registerForPush, requestPushPermission, type PushPermission } from '../push';

/** OS permission state, re-read whenever the app returns to the foreground (e.g. from Settings). */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  const refresh = useCallback(() => {
    void getPushPermission()
      .then(setPermission)
      .catch(() => setPermission('denied'));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (status) => status === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const result = await requestPushPermission();
    setPermission(result);
    const userId = useAuthStore.getState().user?.id;
    if (result === 'granted' && userId) await registerForPush(userId);
    return result;
  }, []);

  return { permission, request, refresh };
}

/**
 * The soft ask. The OS dialog can be shown once; asking at launch (before the
 * shopper has a reason) burns it. This card asks at the moment the value is
 * obvious - right after an order - and only shows the system prompt on "Turn on".
 */
export function PushOptInCard({ reason = 'Get a ping when your order is packed, shipped and out for delivery.' }: { reason?: string }) {
  const { colors } = useTheme();
  const { permission, request } = usePushPermission();

  if (!PUSH_SUPPORTED || permission === null || permission === 'granted') return null;

  return (
    <Animated.View entering={FadeInDown.delay(800).duration(350)} exiting={FadeOut} style={[styles.card, { backgroundColor: colors.secondary }]}>
      <View style={[styles.icon, { backgroundColor: colors.card }]}>
        <BellRing size={20} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text variant="bodyStrong">Live delivery updates</Text>
        <Text variant="caption" tone="mutedForeground">
          {reason}
        </Text>
      </View>
      <Button
        label={permission === 'denied' ? 'Settings' : 'Turn on'}
        size="sm"
        onPress={() => (permission === 'denied' ? void Linking.openSettings() : void request())}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
