import { forwardRef, memo, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius } from '@/theme/tokens';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Extra style for the input itself, e.g. a minHeight for multiline fields. */
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Labelled input with an animated focus ring and inline error. The border colour
 * is interpolated on the UI thread, so focusing a field never re-renders the form.
 */
export const TextField = memo(
  forwardRef<TextInputInstance, TextFieldProps>(function TextField({ label, error, hint, leading, trailing, inputStyle, onFocus, onBlur, ...props }, ref) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const progress = useDerivedValue(() => withTiming(focused ? 1 : 0, { duration: 160 }), [focused]);
    const idle = error ? colors.destructive : colors.input;
    const active = error ? colors.destructive : colors.primary;

    const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(progress.value, [0, 1], [idle, active]) }));

    return (
      <View style={styles.root}>
        <Text variant="captionStrong" tone={error ? 'destructive' : 'mutedForeground'}>
          {label}
        </Text>
        <Animated.View style={[styles.box, { backgroundColor: colors.card }, ring]}>
          {leading}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }, inputStyle]}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            {...props}
          />
          {trailing}
        </Animated.View>
        {error ? (
          <Animated.View entering={FadeIn.duration(150)}>
            <Text variant="caption" tone="destructive">
              {error}
            </Text>
          </Animated.View>
        ) : hint ? (
          <Text variant="caption" tone="mutedForeground">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  root: { gap: 6 },
  box: { minHeight: 50, borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
});
