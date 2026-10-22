import type { CmsBanner } from './cms-types';

export interface BannerSlide {
  id: string;
  eyebrow?: string;
  headline: string;
  subcopy?: string;
  ctaLabel: string;
  linkUrl: string;
  imageUrl?: string;
  imageAlt?: string;
}

/**
 * Shown when the CMS has no banners or is unreachable - the hero must never go
 * blank. Same copy as frontend/web features/home/data.ts heroSlides; these render
 * on the brand gradient since they carry no photo.
 */
export const fallbackSlides: BannerSlide[] = [
  {
    id: 'festive-edit',
    eyebrow: 'Festive edit',
    headline: 'Up to 70% off everything for home',
    subcopy: 'Bedding, decor and kitchen picks from 1,200+ makers.',
    ctaLabel: 'Shop the edit',
    linkUrl: '/c/festive-sale',
  },
  {
    id: 'linen-bedding',
    eyebrow: 'New in bedding',
    headline: 'Linen that gets softer every wash',
    subcopy: 'Stonewashed European flax, from ₹1,499 a set.',
    ctaLabel: 'Shop linen',
    linkUrl: '/c/bedding',
  },
  {
    id: 'under-999',
    eyebrow: 'Under ₹999',
    headline: 'Small upgrades, big difference',
    subcopy: 'Planters, trays, cushion covers and lamps.',
    ctaLabel: 'Browse picks',
    linkUrl: '/c/under-999',
  },
];

export function toBannerSlide(banner: CmsBanner): BannerSlide {
  return {
    id: banner.id,
    eyebrow: banner.eyebrow ?? undefined,
    headline: banner.headline ?? '',
    subcopy: banner.subcopy ?? undefined,
    ctaLabel: banner.ctaLabel ?? 'Shop now',
    linkUrl: banner.linkUrl,
    imageUrl: banner.imageUrl,
    imageAlt: banner.imageAlt,
  };
}
