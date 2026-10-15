'use client';

import { useState } from 'react';
import { Eye, Heart, IndianRupee, PackageCheck, Search, SearchX, type LucideIcon } from 'lucide-react';
import { ExportButton } from '@/components/common/export-button';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankedList } from '@/features/insights/components/ranked-list';
import { TrafficChart } from '@/features/insights/components/traffic-chart';
import { buildInsightsExport } from '@/features/insights/export';
import { useInsights } from '@/features/insights/hooks/use-insights';
import { searchRows, soldRows, viewedRows, wishlistedRows } from '@/features/insights/rows';
import type { InsightRange } from '@/features/insights/types';
import { formatMoney, formatNumber, formatRelative } from '@/lib/format';
import { cn } from 'cn';

const RANGES: { value: InsightRange; label: string }[] = [
  { value: 1, label: 'Today' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-1">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'warning' ? 'bg-status-warning/15 text-status-warning' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          )}
          {hint && !isLoading && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Store performance: what shoppers search for (and fail to find), what they
 * look at, save and buy. Each figure is owned by a different service - see
 * InsightsAdminController - and a panel whose service is down says so instead
 * of breaking the page.
 */
export default function InsightsPage() {
  const [days, setDays] = useState<InsightRange>(30);
  const { data, isLoading, isFetching } = useInsights(days);

  const engagement = data?.engagement.ok ? data.engagement.data : null;
  const sales = data?.sales.ok ? data.sales.data : null;
  const wishlist = data?.wishlist.ok ? data.wishlist.data : null;
  const errorOf = (panel?: { ok: boolean; error?: string }) => (panel && !panel.ok ? panel.error : undefined);

  const searches = engagement?.totals.searches ?? 0;
  const zero = engagement?.totals.zeroSearches ?? 0;
  const successRate = searches > 0 ? ((searches - zero) / searches) * 100 : null;
  const views = engagement?.totals.views ?? 0;
  const conversion = views > 0 && sales ? (sales.totals.orders / views) * 100 : null;

  return (
    <>
      <PageHeader
        title="Insights"
        description={
          data
            ? `How shoppers search, browse, save and buy. Updated ${formatRelative(data.generatedAt)}.`
            : 'How shoppers search, browse, save and buy.'
        }
        actions={
          <ExportButton
            label="Download report"
            filenameBase={`insights-${days}d`}
            onBuild={async () => (data ? buildInsightsExport(data) : { sheets: [] })}
          />
        }
      />

      <Tabs value={String(days)} onValueChange={(value) => setDays(Number(value) as InsightRange)} className="mb-4">
        <TabsList>
          {RANGES.map((range) => (
            <TabsTrigger key={range.value} value={String(range.value)}>
              {range.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Stat label="Product views" value={formatNumber(views)} icon={Eye} isLoading={isLoading} />
          <Stat label="Searches" value={formatNumber(searches)} icon={Search} isLoading={isLoading} />
          <Stat
            label="Searches finding results"
            value={successRate === null ? '—' : `${successRate.toFixed(0)}%`}
            hint={zero > 0 ? `${formatNumber(zero)} found nothing` : undefined}
            icon={SearchX}
            isLoading={isLoading}
            tone={successRate !== null && successRate < 90 ? 'warning' : 'default'}
          />
          <Stat
            label="Units sold"
            value={formatNumber(sales?.totals.units ?? 0)}
            hint={sales ? `${formatNumber(sales.totals.orders)} orders` : undefined}
            icon={PackageCheck}
            isLoading={isLoading}
          />
          <Stat
            label="Revenue"
            value={formatMoney(sales?.totals.revenue ?? 0)}
            hint={conversion === null ? undefined : `${conversion.toFixed(1)} orders per 100 views`}
            icon={IndianRupee}
            isLoading={isLoading}
          />
          <Stat
            label="Wishlist saves"
            value={formatNumber(wishlist?.totals.recent ?? 0)}
            hint={wishlist ? `${formatNumber(wishlist.totals.saves)} saved in total` : undefined}
            icon={Heart}
            isLoading={isLoading}
          />
        </div>

        <div className="mb-4">
          <TrafficChart series={engagement?.series ?? []} isLoading={isLoading} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <RankedList
            title="Most popular searches"
            description="What shoppers type into the search box."
            rows={searchRows(engagement?.topSearches ?? [])}
            isLoading={isLoading}
            error={errorOf(data?.engagement)}
            emptyText="No searches recorded in this period yet."
          />
          <RankedList
            title="Searches with no results"
            description="Demand you're missing - list these products, or add them as search keywords on similar ones."
            rows={searchRows(engagement?.zeroResultSearches ?? [])}
            isLoading={isLoading}
            error={errorOf(data?.engagement)}
            emptyText="Every search found something. 🎉"
            tone="warning"
          />
          <RankedList
            title="Most viewed products"
            description="With orders and conversion (orders per 100 views). High views + low conversion = check price, photos or stock."
            rows={viewedRows(engagement?.topViewed ?? [])}
            isLoading={isLoading}
            error={errorOf(data?.engagement)}
            emptyText="No product views recorded in this period yet."
            thumbnails
          />
          <RankedList
            title="Best sellers"
            description="By units sold. Unpaid, failed and cancelled orders are excluded."
            rows={soldRows(sales?.top ?? [])}
            isLoading={isLoading}
            error={errorOf(data?.sales)}
            emptyText="No completed orders in this period yet."
            thumbnails
          />
          <RankedList
            title="Most wishlisted"
            description="Shoppers who have it saved now, and how many saved it in this period. Good candidates for a price-drop push."
            rows={wishlistedRows(wishlist?.top ?? [], days)}
            isLoading={isLoading}
            error={errorOf(data?.wishlist)}
            emptyText="Nothing has been wishlisted yet."
            thumbnails
            className="lg:col-span-2"
          />
        </div>
      </div>
    </>
  );
}
