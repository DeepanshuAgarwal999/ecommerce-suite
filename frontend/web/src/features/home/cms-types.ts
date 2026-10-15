/**
 * Shapes returned by the admin-managed home page CMS (catalog-service's
 * Banner / HomeSection / HomeSectionTile models). See `data.ts` for the
 * static-content types these feed into.
 */
export interface CmsBanner {
  id: string;
  eyebrow: string | null;
  headline: string | null;
  subcopy: string | null;
  ctaLabel: string | null;
  linkUrl: string;
  imageUrl: string;
  imageAlt: string;
  imagePosition: string | null;
  displayOrder: number;
}

export interface CmsSectionTile {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  /** PRODUCT_TABS: the category this tab lists. */
  categoryId: string | null;
  imageUrl: string;
  imageAlt: string;
  linkUrl: string;
  displayOrder: number;
}

export type CmsSectionLayout = 'TILE_GRID' | 'SPLIT_BANNERS' | 'PRODUCT_GRID' | 'PRODUCT_TABS' | 'DEAL_OF_DAY';

/** Layout knobs - see HomeSectionConfigDto in libs/contracts. All optional. */
export interface CmsSectionConfig {
  tileShape?: 'square' | 'circle' | 'arch';
  tone?: 'plain' | 'wash' | 'festive';
  categoryId?: string;
  sort?: 'newest' | 'rating' | 'popular' | 'price_asc' | 'price_desc';
  limit?: number;
  countdownEndsAt?: string;
  viewAllUrl?: string;
}

export interface CmsHomeSection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  layout: CmsSectionLayout;
  config: CmsSectionConfig | null;
  /** Set when the section only shows during an occasion theme - it then gets the festive heading. */
  themeId: string | null;
  displayOrder: number;
  tiles: CmsSectionTile[];
}
