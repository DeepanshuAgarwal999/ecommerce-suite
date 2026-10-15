'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useInsights } from '../hooks/use-insights';
import { searchRows, soldRows, viewedRows } from '../rows';
import { RankedList } from './ranked-list';

/**
 * Dashboard teaser for the Insights page: last 7 days' top searches, most
 * viewed and best sellers, top 5 each. Same endpoint and cache as the full
 * page, so opening Insights afterwards is instant.
 */
export function InsightsHighlights() {
  const { data, isLoading } = useInsights(7);
  const engagement = data?.engagement.ok ? data.engagement.data : null;
  const sales = data?.sales.ok ? data.sales.data : null;
  const errorOf = (panel?: { ok: boolean; error?: string }) => (panel && !panel.ok ? panel.error : undefined);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">This week&apos;s highlights</h2>
          <p className="text-sm text-muted-foreground">What shoppers searched for, looked at and bought in the last 7 days.</p>
        </div>
        <Link href="/insights" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          All insights
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankedList
          title="Top searches"
          rows={searchRows(engagement?.topSearches ?? [])}
          isLoading={isLoading}
          error={errorOf(data?.engagement)}
          emptyText="No searches yet this week."
          limit={5}
        />
        <RankedList
          title="Most viewed"
          rows={viewedRows(engagement?.topViewed ?? [])}
          isLoading={isLoading}
          error={errorOf(data?.engagement)}
          emptyText="No product views yet this week."
          thumbnails
          limit={5}
        />
        <RankedList
          title="Best sellers"
          rows={soldRows(sales?.top ?? [])}
          isLoading={isLoading}
          error={errorOf(data?.sales)}
          emptyText="No completed orders yet this week."
          thumbnails
          limit={5}
        />
      </div>
    </section>
  );
}
