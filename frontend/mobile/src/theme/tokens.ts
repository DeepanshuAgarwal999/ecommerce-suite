/**
 * Design tokens - the web storefront's palette (frontend/web/src/app/global.css)
 * converted from oklch to sRGB hex, because React Native can't parse oklch.
 * Keep the two in step: a rebrand edits `--primary` there and `primary` here.
 *
 * Names follow the web's semantics: `accent` is a subtle pressed/hover surface,
 * the brand pop colour is `highlight`.
 */
export interface Palette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  /** Soft red surface behind error notices. */
  destructiveWash: string;
  border: string;
  input: string;
  brandDark: string;
  highlight: string;
  highlightForeground: string;
  promo: string;
  promoForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  sale: string;
  saleForeground: string;
  rating: string;
  /** Occasion surfaces; fall back to the everyday brand when no theme is live. */
  festive: string;
  festiveForeground: string;
  festiveGold: string;
  festiveWash: string;
  /** Scrims and skeleton shimmer. */
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
}

export const lightPalette: Palette = {
  background: '#fcf9fb',
  foreground: '#170e16',
  card: '#ffffff',
  cardForeground: '#170e16',
  primary: '#9a0095',
  primaryForeground: '#ffffff',
  secondary: '#faedf8',
  secondaryForeground: '#6d006a',
  muted: '#f5f0f4',
  mutedForeground: '#6e666d',
  accent: '#f7eff6',
  destructive: '#e7000b',
  destructiveWash: '#fdecec',
  border: '#e8e3e7',
  input: '#e2dce1',
  brandDark: '#6d006a',
  highlight: '#f438a6',
  highlightForeground: '#ffffff',
  promo: '#eab532',
  promoForeground: '#312100',
  success: '#008a39',
  successForeground: '#ffffff',
  warning: '#fba62a',
  sale: '#ed3726',
  saleForeground: '#ffffff',
  rating: '#eab532',
  festive: '#6d006a',
  festiveForeground: '#ffffff',
  festiveGold: '#eab532',
  festiveWash: '#faedf8',
  overlay: 'rgba(23,14,22,0.5)',
  skeleton: '#f1eaf0',
  skeletonHighlight: '#faf6f9',
};

export const darkPalette: Palette = {
  background: '#110b10',
  foreground: '#f9f3f8',
  card: '#1e151d',
  cardForeground: '#f9f3f8',
  primary: '#ed6cd5',
  primaryForeground: '#110b10',
  secondary: '#2f212d',
  secondaryForeground: '#f9f3f8',
  muted: '#2b242a',
  mutedForeground: '#a49ba3',
  accent: '#2c232b',
  destructive: '#ff6467',
  destructiveWash: '#3a1517',
  border: 'rgba(255,255,255,0.10)',
  input: 'rgba(255,255,255,0.15)',
  brandDark: '#50004e',
  highlight: '#ff62be',
  highlightForeground: '#110b10',
  promo: '#f0bb3b',
  promoForeground: '#271700',
  success: '#3bb360',
  successForeground: '#110b10',
  warning: '#ffb44b',
  sale: '#ff614d',
  saleForeground: '#110b10',
  rating: '#f0bb3b',
  festive: '#50004e',
  festiveForeground: '#ffffff',
  festiveGold: '#f0bb3b',
  festiveWash: '#2f212d',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: '#251b24',
  skeletonHighlight: '#33272f',
};

/**
 * Occasion skins - light mode only, exactly like the web's `[data-occasion]`
 * blocks: dark mode keeps its own legible palette. Admin hex overrides from the
 * live StoreTheme are applied on top (theme/occasion.ts).
 */
export type OccasionKey = 'diwali' | 'navratri' | 'holi' | 'rakhi' | 'independence' | 'eid' | 'christmas';

export const occasionPalettes: Record<OccasionKey, Partial<Palette>> = {
  diwali: {
    background: '#fef9f1', primary: '#971a20', brandDark: '#650e12', secondary: '#feefdc',
    secondaryForeground: '#721216', highlight: '#ec6f00', promo: '#e9b452', festive: '#940015',
    festiveGold: '#e9b452', festiveWash: '#fff0d4',
  },
  navratri: {
    background: '#fff8f2', primary: '#bd003a', brandDark: '#780022', secondary: '#ffede0',
    highlight: '#ef8600', promo: '#f0bb3b', festive: '#a3003d', festiveGold: '#f0bb3b', festiveWash: '#ffecd8',
  },
  holi: {
    primary: '#cf0088', brandDark: '#5c11a0', highlight: '#f07900', promo: '#f4ce23',
    festive: '#7a31ca', festiveGold: '#f4ce23', festiveWash: '#ffedf8',
  },
  rakhi: {
    background: '#fff8f5', primary: '#cc243d', brandDark: '#7b0f29', highlight: '#ef7926',
    promo: '#edb345', festive: '#b32035', festiveGold: '#edb345', festiveWash: '#fff0e9',
  },
  independence: {
    primary: '#1e3f97', brandDark: '#142c6f', highlight: '#ec7c0e', promo: '#fa8927',
    festive: '#137738', festiveGold: '#fa8927', festiveWash: '#fff2e5',
  },
  eid: {
    background: '#f9fbf5', primary: '#006846', brandDark: '#003f2c', secondary: '#e7f6ed',
    highlight: '#cf9a35', promo: '#e1b75c', festive: '#00513b', festiveGold: '#e1b75c', festiveWash: '#f3f7e9',
  },
  christmas: {
    primary: '#b71824', brandDark: '#004a27', highlight: '#298646', promo: '#e7b643',
    festive: '#095c34', festiveGold: '#e7b643', festiveWash: '#eef8f0',
  },
};

export const fonts = {
  heading: 'BricolageGrotesque_700Bold',
  headingHeavy: 'BricolageGrotesque_800ExtraBold',
  headingMedium: 'BricolageGrotesque_600SemiBold',
  body: 'Manrope_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyHeavy: 'Manrope_800ExtraBold',
} as const;

/** 4-pt spacing scale. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Matches --radius: 0.75rem (12px) on the web. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Page gutter - the 16px side margin every screen shares. */
export const GUTTER = 16;

export const typeScale = {
  display: { fontFamily: fonts.headingHeavy, fontSize: 28, lineHeight: 32 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  subheading: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12 },
  price: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 20 },
} as const;

export type TypeVariant = keyof typeof typeScale;

/** Spring presets so every bounce in the app feels like the same physics. */
export const springs = {
  /** Buttons, chips - quick and tight. */
  press: { damping: 18, stiffness: 400, mass: 0.6 },
  /** Cart bar, sheets - a soft settle. */
  sheet: { damping: 22, stiffness: 220, mass: 0.9 },
  /** Badges, counters - a little overshoot. */
  pop: { damping: 10, stiffness: 320, mass: 0.6 },
} as const;
