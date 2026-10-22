import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useActiveTheme } from '@/features/theme/api';
import { applyOccasion, occasionKeyOf } from '@/features/theme/occasion';
import type { StoreTheme } from '@/features/theme/types';
import { usePreferencesStore } from '@/store/preferences-store';
import { darkPalette, lightPalette, type OccasionKey, type Palette } from './tokens';

export interface AppTheme {
  colors: Palette;
  scheme: 'light' | 'dark';
  isDark: boolean;
  /** Live occasion (light mode only), for festive art and section headings. */
  occasion: OccasionKey | null;
  storeTheme: StoreTheme | null;
}

const ThemeContext = createContext<AppTheme | null>(null);

/**
 * Resolves the palette from three inputs: the shopper's appearance preference
 * (system / light / dark), the OS scheme, and the occasion theme an admin has
 * live. Memoised on those inputs so a re-render of the tree never rebuilds it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const appearance = usePreferencesStore((state) => state.appearance);
  const { data: storeTheme = null } = useActiveTheme();

  const value = useMemo<AppTheme>(() => {
    const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
    const isDark = scheme === 'dark';
    const live = isDark ? null : storeTheme;
    return {
      colors: isDark ? darkPalette : applyOccasion(lightPalette, live),
      scheme,
      isDark,
      occasion: occasionKeyOf(live),
      storeTheme,
    };
  }, [appearance, system, storeTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

/**
 * Builds a StyleSheet from the palette, memoised per palette. The usual pattern:
 *   const styles = useStyles(makeStyles);   // makeStyles defined at module scope
 */
export function useStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
