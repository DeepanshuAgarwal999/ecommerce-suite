export interface SectionTile {
  id: string;
  sectionId: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  categoryId: string | null;
  imageUrl: string;
  imageAlt: string;
  linkUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SectionLayout = 'TILE_GRID' | 'SPLIT_BANNERS' | 'PRODUCT_GRID' | 'PRODUCT_TABS' | 'DEAL_OF_DAY';

/** Mirrors HomeSectionConfigDto in libs/contracts - every key optional. */
export interface SectionConfig {
  tileShape?: 'square' | 'circle' | 'arch';
  tone?: 'plain' | 'wash' | 'festive';
  categoryId?: string;
  sort?: 'newest' | 'rating' | 'popular' | 'price_asc' | 'price_desc';
  limit?: number;
  countdownEndsAt?: string;
  viewAllUrl?: string;
}

/** Mirrors the HomeSection model, including tiles (the admin list always joins them). */
export interface HomeSection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  layout: SectionLayout;
  config: SectionConfig | null;
  themeId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tiles: SectionTile[];
}

export interface HomeSectionInput {
  title: string;
  subtitle?: string;
  slug: string;
  layout?: SectionLayout;
  config?: SectionConfig;
  themeId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface SectionTileInput {
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  categoryId?: string | null;
  imageUrl: string;
  imageAlt: string;
  linkUrl: string;
  isActive?: boolean;
}
