import type { SectionLayout } from './types';

interface LayoutInfo {
  label: string;
  description: string;
  /** What a tile means in this layout; null = the layout uses no tiles. */
  tiles: { noun: string; hint: string } | null;
}

/** Admin-facing copy for each storefront section layout. */
export const sectionLayouts: Record<SectionLayout, LayoutInfo> = {
  TILE_GRID: {
    label: 'Image tiles',
    description: 'A row of image tiles linking anywhere - square, round or festive arch.',
    tiles: { noun: 'tile', hint: 'One image card - e.g. "Diwali" or "Wall paintings".' },
  },
  SPLIT_BANNERS: {
    label: 'Split promo banners',
    description: 'One large promo beside two stacked ones. First tile is the big one.',
    tiles: { noun: 'banner', hint: 'Title, offer line ("Upto 45% off") and button text.' },
  },
  PRODUCT_GRID: {
    label: 'Product grid',
    description: 'A grid of real products from a category, sorted how you choose.',
    tiles: null,
  },
  PRODUCT_TABS: {
    label: 'Tabbed products',
    description: 'Tabs that switch a row of products - one tab per tile, each bound to a category.',
    tiles: { noun: 'tab', hint: 'Tab thumbnail + label, the category it lists, and its "View all" link.' },
  },
  DEAL_OF_DAY: {
    label: 'Deal of the day',
    description: 'A product rail under a live countdown on a tinted band.',
    tiles: null,
  },
};

export const sortOptions = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const;
