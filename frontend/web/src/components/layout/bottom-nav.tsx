'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { bottomNav } from '@/config/nav';
import { useCartItemCount } from '@/features/cart/hooks/use-cart';
import { cn } from '@/lib/utils';

/** Fixed five-tab bar on phones. Hidden from md up where the header carries navigation. */
export function BottomNav() {
  const pathname = usePathname();
  const cartCount = useCartItemCount();

  return (
    <nav
      aria-label="Primary"
      className="bg-card pb-safe fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
    >
      <ul className="grid h-bottom-nav grid-cols-5">
        {bottomNav.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-[22px]" strokeWidth={2} aria-hidden />
                {item.label}
                {item.showsCartCount && cartCount > 0 && (
                  <span className="bg-highlight text-highlight-foreground absolute top-1.5 left-1/2 ml-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold tabular-nums">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
