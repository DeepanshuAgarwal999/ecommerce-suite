import { occasionPalettes, type OccasionKey, type Palette } from '@/theme/tokens';
import type { StoreTheme, ThemeColors, ThemePreset } from './types';

const PRESET_KEY: Record<ThemePreset, OccasionKey | null> = {
  DIWALI: 'diwali',
  NAVRATRI: 'navratri',
  HOLI: 'holi',
  RAKHI: 'rakhi',
  INDEPENDENCE: 'independence',
  EID: 'eid',
  CHRISTMAS: 'christmas',
  CUSTOM: null,
};

/** Admin colour key -> palette keys it drives (web: theme/presets.ts colorTokens). */
const OVERRIDES: Record<keyof ThemeColors, (keyof Palette)[]> = {
  primary: ['primary'],
  brandDark: ['brandDark', 'secondaryForeground'],
  highlight: ['highlight'],
  gold: ['festiveGold', 'promo'],
  surface: ['festive'],
  wash: ['festiveWash'],
};

const HEX = /^#[0-9a-f]{6}$/i;

export function occasionKeyOf(theme: StoreTheme | null | undefined): OccasionKey | null {
  return theme ? PRESET_KEY[theme.preset] : null;
}

/**
 * The palette with the live occasion applied: preset skin first, then the admin's
 * hex overrides. Light mode only - dark mode keeps its own palette, as on the web.
 * Overrides are re-validated here because they come from the network.
 */
export function applyOccasion(base: Palette, theme: StoreTheme | null | undefined): Palette {
  if (!theme) return base;
  const key = occasionKeyOf(theme);
  const palette: Palette = { ...base, ...(key ? occasionPalettes[key] : {}) };

  for (const [name, targets] of Object.entries(OVERRIDES) as [keyof ThemeColors, (keyof Palette)[]][]) {
    const value = theme.colors?.[name];
    if (value && HEX.test(value)) targets.forEach((target) => (palette[target] = value));
  }
  return palette;
}
