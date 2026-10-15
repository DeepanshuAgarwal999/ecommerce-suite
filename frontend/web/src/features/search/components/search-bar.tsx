'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowUpLeft, Clock, LayoutGrid, Search, TrendingUp, X } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';
import { MIN_SUGGEST_LENGTH, useSuggestions } from '../hooks/use-suggestions';
import { useRecentSearches } from '../store/recent-searches';
import { AnimatedPlaceholder } from './animated-placeholder';

interface SearchBarProps {
  className?: string;
  autoFocus?: boolean;
}

/** One selectable row in the dropdown - flattened so ↑/↓ walk every section in order. */
type Option =
  | { kind: 'recent'; key: string; term: string }
  | { kind: 'trending'; key: string; term: string }
  | { kind: 'category'; key: string; label: string; href: string; imageUrl: string | null }
  | { kind: 'product'; key: string; label: string; href: string; imageUrl: string | null; price: number }
  | { kind: 'query'; key: string; term: string };

/** Bold the part of `text` the shopper typed - the Flipkart/Google suggestion style. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong className="text-foreground font-bold">{text.slice(at, at + term.length)}</strong>
      {text.slice(at + term.length)}
    </>
  );
}

/**
 * Header search with a Flipkart/Meesho-style dropdown:
 *  - empty box: the shopper's recent searches (device-local, removable) and
 *    trending chips;
 *  - typing: live suggestions - matching categories, then products with
 *    thumbnail and price - plus a "search for …" row.
 * A WAI-ARIA combobox: ↑/↓ move, Enter picks (or searches), Esc closes.
 * Submitting goes to /search?q= so results stay a real, shareable URL.
 */
export function SearchBar({ className, autoFocus }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const listboxId = useId();
  const inputId = useId();

  const urlTerm = pathname === '/search' ? (params.get('q') ?? '') : '';
  const [value, setValue] = useState(urlTerm);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recent = useRecentSearches((state) => state.terms);
  const addRecent = useRecentSearches((state) => state.add);
  const removeRecent = useRecentSearches((state) => state.remove);
  const clearRecent = useRecentSearches((state) => state.clear);

  const term = value.trim();
  const typing = term.length >= MIN_SUGGEST_LENGTH;
  const suggestions = useSuggestions(open ? term : '');

  // Keep the box in step with the URL (back/forward, a search from elsewhere).
  useEffect(() => setValue(urlTerm), [urlTerm]);

  // Close on any click outside the search box or its dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const options = useMemo<Option[]>(() => {
    if (!typing) {
      return [
        ...(hydrated ? recent : []).map((item) => ({ kind: 'recent' as const, key: `r:${item}`, term: item })),
        ...siteConfig.trendingSearches.map((item) => ({ kind: 'trending' as const, key: `t:${item}`, term: item })),
      ];
    }
    const data = suggestions.data;
    return [
      ...(data?.categories ?? []).map((category) => ({
        kind: 'category' as const,
        key: `c:${category.id}`,
        label: category.name,
        href: `/c/${category.slug}`,
        imageUrl: category.imageUrl,
      })),
      ...(data?.products ?? []).map((product) => ({
        kind: 'product' as const,
        key: `p:${product.id}`,
        label: product.title,
        href: `/p/${product.slug}`,
        imageUrl: product.imageUrl,
        price: product.minPrice,
      })),
      { kind: 'query' as const, key: `q:${term}`, term },
    ];
  }, [typing, hydrated, recent, suggestions.data, term]);

  // A new list invalidates the highlighted row.
  useEffect(() => setActive(-1), [options]);

  function close() {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  }

  function search(raw: string) {
    const q = raw.trim();
    if (!q) return;
    addRecent(q);
    setValue(q);
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function choose(option: Option) {
    switch (option.kind) {
      case 'recent':
      case 'trending':
      case 'query':
        search(option.term);
        return;
      case 'category':
      case 'product':
        // Remember what they typed to get here, like Flipkart does.
        addRecent(term);
        close();
        router.push(option.href);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active >= 0 && options[active]) choose(options[active]);
    else search(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
    if (options.length === 0) return;
    setActive((current) =>
      event.key === 'ArrowDown'
        ? (current + 1) % options.length
        : (current - 1 + options.length) % options.length,
    );
  }

  const optionId = (index: number) => `${listboxId}-opt-${index}`;
  const showDropdown = open && options.length > 0;

  // Section split for rendering; indexes still refer to the flat `options` list.
  const indexed = options.map((option, index) => ({ option, index }));
  const recentRows = indexed.filter(({ option }) => option.kind === 'recent');
  const trendingRows = indexed.filter(({ option }) => option.kind === 'trending');
  const categoryRows = indexed.filter(({ option }) => option.kind === 'category');
  const productRows = indexed.filter(({ option }) => option.kind === 'product');
  const queryRow = indexed.find(({ option }) => option.kind === 'query');

  const rowClass = (index: number) =>
    cn(
      'flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
      index === active ? 'bg-accent' : 'hover:bg-accent/60',
    );

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={onSubmit}
      className={cn('relative', className)}
    >
      <div
        className={cn(
          'bg-background border-input flex h-11 items-center gap-3 rounded-lg border-[1.5px] px-4 transition-[box-shadow,border-color] md:h-12',
          open && 'border-primary ring-primary/20 ring-[3px]',
          showDropdown && 'md:rounded-b-none',
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          Search products
        </label>
        <Search className="text-muted-foreground size-5 shrink-0" aria-hidden />
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {value === '' && (
            <AnimatedPlaceholder hints={siteConfig.searchHints} className="absolute inset-y-0 left-0 right-0" />
          )}
        </div>
        {value !== '' && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent -mr-1.5 grid size-7 shrink-0 place-items-center rounded-full"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="bg-popover text-popover-foreground animate-in fade-in slide-in-from-top-1 absolute inset-x-0 top-full z-50 mt-1.5 max-h-[min(70dvh,520px)] overflow-y-auto overscroll-contain rounded-xl border py-2 shadow-[0_16px_40px_-12px_oklch(0.2_0.05_330/0.25)] duration-150 md:mt-0 md:rounded-t-none md:border-t-0"
        >
          {!typing && recentRows.length > 0 && (
            <Section
              title="Recent searches"
              action={
                <button type="button" onClick={clearRecent} className="text-primary text-xs font-semibold hover:underline">
                  Clear all
                </button>
              }
            >
              {recentRows.map(({ option, index }) =>
                option.kind === 'recent' ? (
                  <div
                    key={option.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    className={cn(rowClass(index), 'group')}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <Clock className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{option.term}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${option.term} from recent searches`}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeRecent(option.term);
                      }}
                      className="text-muted-foreground hover:text-foreground hover:bg-background grid size-6 place-items-center rounded-full md:opacity-0 md:group-hover:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null,
              )}
            </Section>
          )}

          {!typing && trendingRows.length > 0 && (
            <Section title="Trending searches">
              <div className="flex flex-wrap gap-2 px-4 pt-1 pb-2">
                {trendingRows.map(({ option, index }) =>
                  option.kind === 'trending' ? (
                    <span
                      key={option.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                        index === active ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40',
                      )}
                    >
                      <TrendingUp className="text-primary size-3.5" aria-hidden />
                      {option.term}
                    </span>
                  ) : null,
                )}
              </div>
            </Section>
          )}

          {typing && categoryRows.length > 0 && (
            <Section title="Categories">
              {categoryRows.map(({ option, index }) =>
                option.kind === 'category' ? (
                  <div
                    key={option.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    className={rowClass(index)}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <Thumb src={option.imageUrl} rounded fallback={<LayoutGrid className="size-4" aria-hidden />} />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                      <Highlight text={option.label} term={term} />
                    </span>
                    <span className="text-muted-foreground text-xs">Category</span>
                  </div>
                ) : null,
              )}
            </Section>
          )}

          {typing && productRows.length > 0 && (
            <Section title="Products">
              {productRows.map(({ option, index }) =>
                option.kind === 'product' ? (
                  <div
                    key={option.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    className={rowClass(index)}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <Thumb src={option.imageUrl} fallback={<Search className="size-4" aria-hidden />} />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                      <Highlight text={option.label} term={term} />
                    </span>
                    <span className="text-foreground shrink-0 text-[13px] font-semibold">{formatPrice(option.price)}</span>
                  </div>
                ) : null,
              )}
            </Section>
          )}

          {typing && suggestions.isFetched && categoryRows.length === 0 && productRows.length === 0 && (
            <p className="text-muted-foreground px-4 py-2 text-sm">No quick matches - search anyway?</p>
          )}

          {queryRow && queryRow.option.kind === 'query' && (
            <div
              id={optionId(queryRow.index)}
              role="option"
              aria-selected={queryRow.index === active}
              className={cn(rowClass(queryRow.index), 'mt-1 border-t pt-2.5')}
              onMouseEnter={() => setActive(queryRow.index)}
              onClick={() => choose(queryRow.option)}
            >
              <Search className="text-primary size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                Search for <strong className="font-bold">&ldquo;{queryRow.option.term}&rdquo;</strong>
              </span>
              <ArrowUpLeft className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="py-1">
      <div className="flex items-center justify-between px-4 pt-1 pb-1.5">
        <p className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Thumb({ src, rounded, fallback }: { src: string | null; rounded?: boolean; fallback: ReactNode }) {
  return (
    <span
      className={cn(
        'bg-secondary text-muted-foreground relative grid size-10 shrink-0 place-items-center overflow-hidden',
        rounded ? 'rounded-full' : 'rounded-lg',
      )}
    >
      {src ? <Image src={src} alt="" fill sizes="40px" className="object-cover" /> : fallback}
    </span>
  );
}
