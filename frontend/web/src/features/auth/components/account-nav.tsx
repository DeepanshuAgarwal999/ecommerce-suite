'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { accountNav } from '@/config/nav';
import { cn } from '@/lib/utils';

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="mb-6 md:mb-0">
      <ul className="rail md:flex-col md:gap-1">
        {accountNav.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors md:flex',
                  active
                    ? 'bg-secondary text-secondary-foreground font-bold'
                    : 'text-foreground/80 hover:bg-accent',
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
