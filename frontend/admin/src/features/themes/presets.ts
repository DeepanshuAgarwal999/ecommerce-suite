import type { ThemeColors, ThemePreset } from './types';

interface PresetInfo {
  label: string;
  /** What the storefront dresses itself in for this preset. */
  decor: string;
  /** The storefront's built-in palette for the preset (light mode), as hex -
   *  prefills the colour pickers and draws the preview swatch. Keep in step
   *  with the [data-occasion] blocks in frontend/web/src/app/global.css. */
  colors: Required<ThemeColors>;
}

export const themePresets: Record<ThemePreset, PresetInfo> = {
  DIWALI: {
    label: 'Diwali',
    decor: 'Marigold & diya garland, gold-framed arch tiles, warm cream page',
    colors: { primary: '#8e1b1b', brandDark: '#5e1414', highlight: '#e0692a', gold: '#d9b25c', surface: '#8a1515', wash: '#fbefd6' },
  },
  NAVRATRI: {
    label: 'Navratri / Durga Puja',
    decor: 'Marigold garland, vibrant red & saffron',
    colors: { primary: '#b0123a', brandDark: '#73122a', highlight: '#ef8a2a', gold: '#e9bb47', surface: '#9c0f2c', wash: '#fdeedd' },
  },
  HOLI: {
    label: 'Holi',
    decor: 'Gulal colour splashes across the page',
    colors: { primary: '#d2187a', brandDark: '#5b1b8f', highlight: '#f0832a', gold: '#f5cf32', surface: '#7b23b5', wash: '#fdeef5' },
  },
  RAKHI: {
    label: 'Raksha Bandhan',
    decor: 'Rakhi & marigold garland',
    colors: { primary: '#d03a3f', brandDark: '#7c2026', highlight: '#ec7f30', gold: '#d8ae58', surface: '#b5303a', wash: '#fdf0e8' },
  },
  INDEPENDENCE: {
    label: 'Independence / Republic Day',
    decor: 'Tricolour bunting',
    colors: { primary: '#1f3a8a', brandDark: '#16296a', highlight: '#f08a2c', gold: '#f39a35', surface: '#1f7a43', wash: '#fdf3e8' },
  },
  EID: {
    label: 'Eid',
    decor: 'Lanterns, crescent & stars',
    colors: { primary: '#0f6b55', brandDark: '#0b4637', highlight: '#c79a3e', gold: '#d6b25e', surface: '#0d5242', wash: '#f2f7ec' },
  },
  CHRISTMAS: {
    label: 'Christmas',
    decor: 'Bauble garland, red & pine green',
    colors: { primary: '#b5262a', brandDark: '#1d4a32', highlight: '#2f7a4f', gold: '#d8b252', surface: '#1f5a3c', wash: '#eef6f0' },
  },
  CUSTOM: {
    label: 'Custom (colours only)',
    decor: 'No artwork - your palette only',
    colors: { primary: '#8a1f8c', brandDark: '#5b1660', highlight: '#e3398a', gold: '#e4bd4d', surface: '#5b1660', wash: '#f6eef8' },
  },
};

export const colorFields: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links, prices' },
  { key: 'brandDark', label: 'Brand dark', hint: 'Announcement bar, hero overlay' },
  { key: 'highlight', label: 'Highlight', hint: 'Badges, accents' },
  { key: 'gold', label: 'Gold', hint: 'Trim, arch frames, chips' },
  { key: 'surface', label: 'Festive surface', hint: 'Deep band behind festive sections' },
  { key: 'wash', label: 'Wash', hint: 'Soft band behind deals' },
];

/** Where `now` falls against a theme's window - drives the Scheduled / Ended labels. */
export function scheduleState(
  theme: { startsAt: string | null; endsAt: string | null },
  now = Date.now(),
): 'scheduled' | 'ended' | 'in-window' {
  if (theme.startsAt && Date.parse(theme.startsAt) > now) return 'scheduled';
  if (theme.endsAt && Date.parse(theme.endsAt) < now) return 'ended';
  return 'in-window';
}

/** ISO -> the "YYYY-MM-DDTHH:mm" a datetime-local input wants, in the admin's own timezone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
