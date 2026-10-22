/** Mirrors catalog-service's StoreTheme / ThemePreset (libs/contracts). */
export type ThemePreset =
  | 'DIWALI'
  | 'HOLI'
  | 'NAVRATRI'
  | 'RAKHI'
  | 'INDEPENDENCE'
  | 'EID'
  | 'CHRISTMAS'
  | 'CUSTOM';

/** Hex overrides an admin set on top of the preset's built-in palette. */
export interface ThemeColors {
  primary?: string;
  brandDark?: string;
  highlight?: string;
  gold?: string;
  surface?: string;
  wash?: string;
}

export interface StoreTheme {
  id: string;
  name: string;
  preset: ThemePreset;
  colors: ThemeColors | null;
  announcement: string | null;
}
