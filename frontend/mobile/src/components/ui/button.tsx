import { memo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 46, lg: 54 };

export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  trailing,
  fullWidth,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.secondary },
    outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent' },
    destructive: { bg: colors.destructive, fg: '#ffffff', border: colors.destructive },
  };
  const tone = palette[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptics="light"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      activeScale={0.97}
      style={[
        styles.base,
        { height: HEIGHT[size], backgroundColor: tone.bg, borderColor: tone.border },
        size === 'sm' && styles.small,
        fullWidth && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant={size === 'sm' ? 'captionStrong' : 'subheading'} style={{ color: tone.fg }}>
            {label}
          </Text>
          {trailing}
        </View>
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  small: { paddingHorizontal: 12, borderRadius: radius.sm },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
