import type { ThemeColors, ThemePreset } from './types';

/** Which hanging ornament the garland under the header uses. */
export type GarlandMotif = 'marigold' | 'gulal' | 'bunting' | 'lantern' | 'bauble' | 'rakhi' | 'none';

interface PresetMeta {
  /** Lower-case key written to <html data-occasion>; global.css hangs the palette off it. */
  key: string;
  motif: GarlandMotif;
}

export const presetMeta: Record<ThemePreset, PresetMeta> = {
  DIWALI: { key: 'diwali', motif: 'marigold' },
  NAVRATRI: { key: 'navratri', motif: 'marigold' },
  HOLI: { key: 'holi', motif: 'gulal' },
  RAKHI: { key: 'rakhi', motif: 'rakhi' },
  INDEPENDENCE: { key: 'independence', motif: 'bunting' },
  EID: { key: 'eid', motif: 'lantern' },
  CHRISTMAS: { key: 'christmas', motif: 'bauble' },
  CUSTOM: { key: 'custom', motif: 'none' },
};

/** Theme colour key -> the CSS custom properties it drives. */
const colorTokens: Record<keyof ThemeColors, string[]> = {
  primary: ['--primary', '--ring', '--sidebar-primary', '--chart-1'],
  brandDark: ['--brand-dark', '--secondary-foreground'],
  highlight: ['--highlight', '--chart-2'],
  gold: ['--festive-gold', '--promo'],
  surface: ['--festive'],
  wash: ['--festive-wash'],
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * CSS for an admin's colour overrides, scoped to light mode so dark mode keeps
 * its own legible palette. Values are re-validated here even though the API
 * already did, because they are interpolated into a <style> tag.
 */
export function themeOverrideCss(colors: ThemeColors | null): string {
  if (!colors) return '';
  const declarations = (Object.keys(colorTokens) as (keyof ThemeColors)[])
    .filter((key) => colors[key] && HEX.test(colors[key] as string))
    .flatMap((key) => colorTokens[key].map((token) => `${token}:${colors[key]};`));
  return declarations.length > 0 ? `:root:not(.dark){${declarations.join('')}}` : '';
}
