export const siteConfig = {
  /** Placeholder wordmark from the design canvas — replace with the real brand. */
  name: 'nestora',
  tagline: 'Everything for the home, from 1,200+ Indian makers',
  description:
    'Shop bedding, decor, kitchen, bath and furnishings with free delivery over ₹999 and 7-day returns.',
  defaultLocale: 'en-IN',
  currency: 'INR',
  /** Words the search box placeholder cycles through: "Search for <hint>". */
  searchHints: [
    'cushion covers',
    'linen bedsheets',
    'ceramic planters',
    'table runners',
    'bath mats',
    'wall clocks',
    'dinner sets',
    'string lights',
  ],
  /** Chips shown in the empty search dropdown. Swap for analytics-driven terms later. */
  trendingSearches: ['Diwali decor', 'Bedsheets', 'Cushion covers', 'Table lamps', 'Dinner sets', 'Planters'],
  support: {
    email: 'support@example.com',
    phone: '+911234567890',
  },
} as const;

export type SiteConfig = typeof siteConfig;
