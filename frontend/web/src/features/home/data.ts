import type { CmsBanner } from './cms-types';

/**
 * Merchandising content for the home page. Static for now; the admin app will
 * own this once the CMS endpoints exist, at which point this file becomes a
 * fetch in features/home/api.
 */
export interface HeroSlide {
  id: string;
  /** Omitted entirely rather than shown empty — see HeroCarousel's conditional render. */
  eyebrow?: string;
  headline: string;
  subcopy?: string;
  cta: { label: string; href: string };
  /**
   * Full-bleed photo behind the copy (from /public/images/banners). Slides
   * without one fall back to the illustrated still-life on the brand colour.
   */
  image?: {
    src: string;
    alt: string;
    /** CSS object-position — keep the subject clear of the copy on the left. */
    position?: string;
  };
}

export const heroSlides: HeroSlide[] = [
  {
    id: 'festive-edit',
    eyebrow: 'Festive edit',
    headline: 'Up to 70% off everything for home',
    subcopy:
      'Bedding, decor and kitchen picks from 1,200+ makers. New drops every Friday.',
    cta: { label: 'Shop the edit', href: '/c/festive-sale' },
    image: {
      src: '/images/banners/home-banner.jpg',
      alt: 'Cream sofa with orange cushions beside a wooden staircase and a brass lamp',
      position: '72% 60%',
    },
  },
  {
    id: 'linen-bedding',
    eyebrow: 'New in bedding',
    headline: 'Linen that gets softer every wash',
    subcopy: 'Stonewashed European flax, from ₹1,499 a set.',
    cta: { label: 'Shop linen', href: '/c/bedding/linen' },
  },
  {
    id: 'under-999',
    eyebrow: 'Under ₹999',
    headline: 'Small upgrades, big difference',
    subcopy: 'Planters, trays, cushion covers and lamps that lift a room.',
    cta: { label: 'Browse picks', href: '/c/under-999' },
  },
];

export interface Usp {
  id: string;
  title: string;
  detail: string;
}

export const usps: Usp[] = [
  { id: 'delivery', title: 'Free delivery', detail: 'On orders over ₹999' },
  { id: 'returns', title: '7-day returns', detail: 'No questions asked' },
  { id: 'payments', title: 'Secure payments', detail: 'UPI, cards, COD' },
  { id: 'makers', title: 'Made by makers', detail: '1,200+ Indian studios' },
];

/** Maps one admin-managed banner row onto the shape HeroCarousel renders. */
export function toHeroSlide(banner: CmsBanner): HeroSlide {
  return {
    id: banner.id,
    eyebrow: banner.eyebrow ?? undefined,
    headline: banner.headline ?? '',
    subcopy: banner.subcopy ?? undefined,
    cta: { label: banner.ctaLabel ?? 'Shop now', href: banner.linkUrl },
    image: {
      src: banner.imageUrl,
      alt: banner.imageAlt,
      position: banner.imagePosition ?? undefined,
    },
  };
}
