import { Suspense } from 'react';
import { HeaderActions } from './header-actions';
import { Logo } from './logo';
import { SearchBar } from './search-bar';

/**
 * Sticky brand + search + actions row. On phones the search box drops to a
 * second line so it can be full width — the single most-used control.
 */
export function SiteHeader() {
  return (
    <header className="bg-card sticky top-0 z-40 border-b md:border-b-0">
      <div className="container flex flex-col gap-2.5 py-2.5 md:h-header md:flex-row md:items-center md:gap-12 md:py-0">
        <div className="flex items-center justify-between">
          <Logo className="md:hidden" size={22} />
          <Logo className="hidden md:inline-flex" />
          <HeaderActions className="md:hidden" />
        </div>

        <Suspense fallback={<div className="h-11 md:h-12 md:max-w-[620px] md:flex-1" />}>
          <SearchBar className="md:max-w-[620px] md:flex-1" />
        </Suspense>

        <HeaderActions className="ml-auto hidden md:flex" />
      </div>
    </header>
  );
}
