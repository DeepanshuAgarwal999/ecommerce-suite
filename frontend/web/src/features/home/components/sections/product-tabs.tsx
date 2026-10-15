'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
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
 *
 * Tabs are a centred row of pill chips (thumbnail + label): the active one is
 * filled with the brand colour and lifted, the rest are quiet outlined chips.
 * The row scrolls sideways on phones; ←/→ (and Home/End) move between tabs,
 * per the WAI-ARIA tabs pattern.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(0);
  // Only animate after the first switch - the server-rendered first tab should
  // paint immediately, not fade in from nothing.
  const [switched, setSwitched] = useState(false);
  const current = tabs[active] ?? tabs[0];
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    setActive(index);
    setSwitched(true);
    const button = buttons.current[index];
    button?.focus();
    // Keep the chosen chip visible when the row is scrolled on a phone.
    button?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (active + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (active - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product categories"
        onKeyDown={onKeyDown}
        className="rail -mx-4 gap-2 px-4 py-1 md:mx-0 md:flex-wrap md:justify-center md:gap-3 md:overflow-visible md:px-0"
      >
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              className={cn(
                'group flex h-12 items-center gap-2.5 rounded-full border py-1 pr-5 pl-1 text-sm font-semibold whitespace-nowrap transition-all duration-200 md:h-14 md:pr-6 md:text-[15px]',
                'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                selected
                  ? 'bg-primary border-primary text-primary-foreground -translate-y-0.5 shadow-[0_8px_20px_-6px_color-mix(in_oklch,var(--primary)_60%,transparent)]'
                  : 'bg-card text-foreground/80 hover:border-primary/40 hover:text-foreground border-border hover:-translate-y-0.5 hover:shadow-sm',
              )}
            >
              <span
                className={cn(
                  'relative size-10 shrink-0 overflow-hidden rounded-full ring-2 transition-[box-shadow] md:size-12',
                  selected ? 'ring-primary-foreground/70' : 'ring-transparent',
                )}
              >
                <Image
                  src={tab.imageUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </span>
              {tab.title}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="pt-6"
      >
        {/* Re-keyed per tab so the enter animation replays on every switch. */}
        <div key={current.id} className={cn(switched && 'animate-in fade-in slide-in-from-bottom-2 duration-300')}>
          {current.panel}
        </div>
        <div className="mt-6 flex justify-center">
          <Link
            href={current.linkUrl}
            className="group/link text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground inline-flex h-11 items-center gap-2 rounded-full border px-6 text-sm font-bold transition-colors"
          >
            View all {current.title}
            <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
