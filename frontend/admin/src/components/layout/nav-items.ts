import {
  GalleryHorizontal,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Also highlighted when the path is a descendant, e.g. /vendors/:id. */
  matchPrefix?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Vendors', href: '/vendors', icon: Store, matchPrefix: true },
  { label: 'Products', href: '/products', icon: Package, matchPrefix: true },
  { label: 'Inventory', href: '/inventory', icon: Warehouse, matchPrefix: true },
  { label: 'Orders', href: '/orders', icon: ShoppingCart, matchPrefix: true },
  { label: 'Storefront', href: '/storefront', icon: GalleryHorizontal, matchPrefix: true },
  { label: 'Settings', href: '/settings', icon: Settings },
];
