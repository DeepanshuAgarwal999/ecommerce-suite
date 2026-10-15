'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  autoFocus?: boolean;
}

/**
 * Header search. Submits to /search?q= so results are a real, shareable URL
 * and the listing page owns fetching. The hint term rotates per mount.
 */
export function SearchBar({ className, autoFocus }: SearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const inputId = useId();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [hint] = useState(
    () =>
      siteConfig.searchHints[
        Math.floor(Math.random() * siteConfig.searchHints.length)
      ],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn(
        'bg-background border-input focus-within:border-primary focus-within:ring-primary/20 flex h-11 items-center gap-3 rounded-lg border-[1.5px] px-4 transition-[box-shadow,border-color] focus-within:ring-[3px] md:h-12',
        className,
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <Search
        className="text-muted-foreground size-5 shrink-0"
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={`Search for ${hint}`}
        autoComplete="off"
        enterKeyHint="search"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[15px] outline-none"
      />
    </form>
  );
}
