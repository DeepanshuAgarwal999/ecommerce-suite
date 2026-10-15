'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ProductTab {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  /** Server-rendered product cards for this tab. */
  panel: ReactNode;
}

/**
 * The interactive half of ProductTabsSection. Every panel is rendered on the
 * server and passed in, so switching tabs is instant and needs no fetch - only
 * the active index lives on the client.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="rail -mx-4 border-b px-4 md:mx-0 md:grid md:grid-flow-col md:auto-cols-fr md:px-0">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={cn(
              'flex items-center gap-3 border-b-[3px] px-2 py-2.5 text-left text-sm font-semibold transition-colors md:px-1 md:text-base',
              index === active
                ? 'border-primary from-primary/8 text-primary bg-gradient-to-t to-transparent'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            <span className="relative size-10 shrink-0 overflow-hidden rounded-lg md:size-14">
              <Image src={tab.imageUrl} alt="" fill sizes="56px" className="object-cover" />
            </span>
            <span className="whitespace-nowrap">{tab.title}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-4">
        {current.panel}
        <div className="mt-5 flex justify-center">
          <Link
            href={current.linkUrl}
            className="border-foreground/70 hover:bg-foreground hover:text-background inline-flex h-10 items-center rounded-lg border px-6 text-sm font-bold transition-colors"
          >
            View all {current.title}
          </Link>
        </div>
      </div>
    </div>
  );
}
