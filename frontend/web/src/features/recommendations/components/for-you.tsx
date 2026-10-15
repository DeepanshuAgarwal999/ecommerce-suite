'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useForYou } from '../hooks/use-recommendations';
import { RecsRail } from './recs-rail';

/**
 * The returning-shopper part of the home page: what they looked at last, the
 * categories they keep coming back to, and products picked from their history.
 * Client-only (the home page itself stays a shared, cached page); renders nothing
 * for a first-time visitor until there is something personal to show - the
 * trending rail is shown either way.
 */
export function ForYou() {
  const { data } = useForYou();
  if (!data) return null;
  const { recentlyViewed, categories, recommended } = data;
  if (!recentlyViewed.items.length && !categories.length && !recommended.items.length) return null;

  return (
    <div className="container">
      <RecsRail
        title="Continue where you left off"
        subtitle="Recently viewed"
        products={recentlyViewed.items}
        trackImpressions={false}
      />

      {categories.length > 0 && (
        <section aria-label="Your favourite categories" className="pt-8 md:pt-12">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Sparkles className="text-primary size-4" aria-hidden />
            Because you love these
          </h2>
          <ul className="rail -mx-4 gap-2.5 px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/c/${category.slug}`}
                  className="bg-card hover:border-primary/40 flex h-12 items-center gap-2.5 rounded-full border py-1 pr-5 pl-1 text-sm font-semibold whitespace-nowrap transition-colors"
                >
                  <span className="bg-secondary relative size-10 shrink-0 overflow-hidden rounded-full">
                    {category.imageUrl && (
                      <Image src={category.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecsRail
        title={recommended.source === 'personal' ? 'Picked for you' : 'Trending now'}
        subtitle={recommended.source === 'personal' ? 'Based on what you’ve browsed and bought' : 'What everyone’s loving this week'}
        products={recommended.items}
      />
    </div>
  );
}
