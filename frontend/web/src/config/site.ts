export const siteConfig = {
  /** Placeholder wordmark from the design canvas — replace with the real brand. */
  name: 'nestora',
  tagline: 'Everything for the home, from 1,200+ Indian makers',
  description:
    'Shop bedding, decor, kitchen, bath and furnishings with free delivery over ₹999 and 7-day returns.',
  defaultLocale: 'en-IN',
  currency: 'INR',
  /** Rotating hint inside the search box, one per render. */
  searchHints: [
    'cushion covers',
    'linen bedsheets',
    'ceramic planters',
    'table runners',
    'bath mats',
  ],
  support: {
    email: 'support@example.com',
    phone: '+911234567890',
  },
} as const;

export type SiteConfig = typeof siteConfig;
