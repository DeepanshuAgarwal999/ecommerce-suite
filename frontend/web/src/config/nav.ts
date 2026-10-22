import {
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Renders the live cart count on top of the icon. */
  showsCartCount?: boolean;
}

export interface CategoryNavItem {
  label: string;
  slug: string;
  /** Rendered in the sale colour with a star — one per nav, at most. */
  highlight?: boolean;
}

/** Announcement bar, left cluster. Kept to three so it fits at 1280. */
export const announcementUsps = [
  'Free delivery over ₹999',
  '7-day easy returns',
  'Cash on delivery',
] as const;

/** Announcement bar, right cluster. */
export const announcementLinks = [
  { label: 'Track order', href: '/account/orders' },
  { label: 'Help centre', href: '/help' },
  { label: 'Sell with us', href: '/sell' },
] as const;

/** Desktop category row under the header. Slugs must match catalog-service's
 *  category rows exactly (see apps/catalog-service/prisma/seed.ts) - this list
 *  does not call the backend, so a mismatch here 404s silently until clicked. */
export const categoryNav: CategoryNavItem[] = [
  { label: 'Bedding', slug: 'bedding' },
  { label: 'Cushions & Covers', slug: 'cushions-covers' },
  { label: 'Wall Decor', slug: 'wall-decor' },
  { label: 'Kitchen & Dining', slug: 'kitchen-dining' },
  { label: 'Storage', slug: 'storage-organization' },
  { label: 'Bath', slug: 'bath' },
  { label: 'Lighting', slug: 'lighting' },
  { label: 'Rugs & Carpets', slug: 'rugs-carpets' },
  { label: 'Furniture', slug: 'furniture' },
  { label: 'Garden & Balcony', slug: 'garden-balcony', highlight: true },
];

/** Mobile bottom bar — the primary navigation on a phone-first storefront. */
export const bottomNav: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/c/all', icon: LayoutGrid },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Cart', href: '/cart', icon: ShoppingCart, showsCartCount: true },
  { label: 'Account', href: '/account', icon: User },
];

export const accountNav = [
  { label: 'Profile', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Wishlist', href: '/account/wishlist' },
  { label: 'Addresses', href: '/account/addresses' },
  { label: 'Support', href: '/account/support' },
] as const;

export const footerNav = [
  {
    title: 'Shop',
    links: [
      { label: 'New arrivals', href: '/c/new' },
      { label: 'Bestsellers', href: '/c/bestsellers' },
      { label: 'Under ₹999', href: '/c/under-999' },
      { label: 'Gift cards', href: '/gift-cards' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Track order', href: '/account/orders' },
      { label: 'Returns & refunds', href: '/returns' },
      { label: 'Shipping', href: '/shipping' },
      { label: 'Contact us', href: '/contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Sell with us', href: '/sell' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
    ],
  },
] as const;
