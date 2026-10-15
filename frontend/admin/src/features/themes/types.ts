/** Mirrors StoreTheme in apps/catalog-service/prisma/schema.prisma. */
export type ThemePreset =
  | 'DIWALI'
  | 'HOLI'
  | 'NAVRATRI'
  | 'RAKHI'
  | 'INDEPENDENCE'
  | 'EID'
  | 'CHRISTMAS'
  | 'CUSTOM';

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
  isActive: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeInput {
  name: string;
  preset: ThemePreset;
  colors?: ThemeColors;
  announcement?: string | null;
  isActive?: boolean;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}
