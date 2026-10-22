import { memo } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/theme-provider';
import { typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** A palette key, so text recolours with the theme and occasion skins. */
  tone?: keyof Palette;
  /** Fixed-width digits for prices and counters that animate. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

/**
 * The only text primitive screens use. Font scaling is allowed (accessibility)
 * but capped so a 200% system font can't break dense product cards.
 */
export const Text = memo(function Text({
  variant = 'body',
  tone = 'foreground',
  tabular,
  align,
  style,
  maxFontSizeMultiplier = 1.4,
  ...props
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typeScale[variant],
        { color: colors[tone] },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...props}
    />
  );
});
