import { forwardRef, memo, useEffect } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius } from '@/theme/tokens';

export const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

/**
 * Six boxes over one hidden TextInput. A single input (not six) is what lets
 * iOS "From Messages" and Android SMS autofill drop the whole code in at once.
 * Shakes when `error` flips on.
 */
export const OtpInput = memo(
  forwardRef<TextInputInstance, OtpInputProps>(function OtpInput({ value, onChange, error, disabled }, ref) {
    const { colors } = useTheme();
    const shake = useSharedValue(0);

    useEffect(() => {
      if (error) shake.value = withSequence(withRepeat(withTiming(8, { duration: 50 }), 5, true), withTiming(0, { duration: 50 }));
    }, [error, shake]);

    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

    return (
      <Pressable onPress={() => (ref as React.RefObject<TextInputInstance | null>)?.current?.focus()} accessibilityLabel="One-time code">
        <Animated.View style={[styles.row, shakeStyle]}>
          {Array.from({ length: OTP_LENGTH }, (_, index) => {
            const char = value[index];
            const active = index === value.length && !disabled;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  {
                    borderColor: error ? colors.destructive : active ? colors.primary : char ? colors.foreground : colors.border,
                    backgroundColor: colors.card,
                  },
                  active && styles.activeCell,
                ]}
              >
                <Text variant="title" tabular>
                  {char ?? ''}
                </Text>
              </View>
            );
          })}
        </Animated.View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          editable={!disabled}
          caretHidden
          style={styles.hidden}
          accessibilityLabel="Enter the 6 digit code"
        />
      </Pressable>
    );
  }),
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cell: { flex: 1, aspectRatio: 0.86, maxWidth: 52, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  activeCell: { borderWidth: 2 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1, fontFamily: fonts.body },
});
