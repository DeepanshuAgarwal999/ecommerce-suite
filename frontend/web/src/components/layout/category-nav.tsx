'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { categoryNav } from '@/config/nav';
import { cn } from '@/lib/utils';

/** Desktop category row under the header. Phones get the chips rail instead. */
export function CategoryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Categories"
      className="bg-card hidden h-category-nav border-y md:block"
    >
      <ul className="container scrollbar-none flex h-full items-center gap-[30px] overflow-x-auto text-[14.5px] font-semibold whitespace-nowrap">
        {categoryNav.map((item) => {
          const href = `/c/${item.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={item.slug} className="h-full">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full items-center gap-1.5 transition-colors',
                  item.highlight
                    ? 'text-sale hover:text-sale/80'
                    : 'text-foreground/85 hover:text-primary',
                  active && 'text-primary shadow-[inset_0_-3px_0_0_var(--primary)]',
                )}
              >
                {item.highlight && <Sparkles className="size-[15px]" aria-hidden />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
