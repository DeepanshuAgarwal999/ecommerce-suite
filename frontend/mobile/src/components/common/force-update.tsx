import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { onUpgradeRequired } from '@/lib/api/client';
import { useTheme } from '@/theme/theme-provider';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id0000000000',
  default: 'https://play.google.com/store/apps/details?id=com.nestora.app',
});

/**
 * Blocking "please update" screen. Shown when the gateway answers 426 (its
 * minimum-app-version gate in ClientContextMiddleware), so an API change that
 * old builds can't handle never shows those users a broken screen.
 */
export function ForceUpdateGate() {
  const { colors } = useTheme();
  const [required, setRequired] = useState<string | undefined | null>(null);

  useEffect(() => onUpgradeRequired((minimum) => setRequired(minimum ?? '')), []);

  return (
    <Modal visible={required !== null} animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Download size={36} color={colors.primary} />
        </View>
        <Text variant="title" align="center">
          Time for an update
        </Text>
        <Text tone="mutedForeground" align="center">
          {required ? `This version is no longer supported. Please update to ${required} or later.` : 'This version is no longer supported. Please update to continue.'}
        </Text>
        <Button label="Update now" onPress={() => void Linking.openURL(STORE_URL)} fullWidth />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
