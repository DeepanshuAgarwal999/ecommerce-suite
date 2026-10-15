import {
  Boxes,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export interface ConsoleNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Sidebar links for an approved seller. Gated screens (apply/pending) have no nav. */
export const consoleNav: ConsoleNavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Settings', href: '/settings', icon: Settings },
];
