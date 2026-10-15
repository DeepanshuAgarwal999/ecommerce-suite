'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { categoryNav } from '@/config/nav';
import { cn } from '@/lib/utils';

/** Phone-only horizontal category rail under the search box. */
export function CategoryChips() {
  const pathname = usePathname();
  const items = [{ label: 'All', slug: 'all' }, ...categoryNav];

  return (
    <nav aria-label="Categories" className="bg-card border-b md:hidden">
      <ul className="rail container gap-2 py-2.5">
        {items.map((item) => {
          const href = item.slug === 'all' ? '/' : `/c/${item.slug}`;
          const active = pathname === href;
          return (
            <li key={item.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-[34px] items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'border-input border-[1.5px]',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
