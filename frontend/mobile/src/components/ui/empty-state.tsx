import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/theme/theme-provider';
import { Button } from './button';
import { Text } from './text';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = memo(function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.root}>
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>{icon}</View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="mutedForeground" align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, flex: 1 },
  icon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  description: { maxWidth: 280 },
  action: { marginTop: 12, minWidth: 180 },
});
