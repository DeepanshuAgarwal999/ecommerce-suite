'use client';

import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Award, CircleAlert, Clock, Info, ShieldAlert, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatMoney } from '@/lib/format';
import { useProductInsights, type HealthVerdict, type ProductInsights } from './insights-api';

const VERDICT: Record<HealthVerdict, { label: string; tone: string; icon: typeof Award; summary: string }> = {
  star: {
    label: 'Star performer',
    tone: 'border-status-success/40 bg-status-success/10 text-status-success',
    icon: Award,
    summary: 'Well worth listing - draws more attention and converts better than its category.',
  },
  healthy: {
    label: 'Healthy',
    tone: 'border-status-success/40 bg-status-success/10 text-status-success',
    icon: TrendingUp,
    summary: 'Worth keeping - performing in line with its category.',
  },
  needs_attention: {
    label: 'Needs attention',
    tone: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
    icon: Wrench,
    summary: 'Has potential, but one part of the funnel is leaking - fixable.',
  },
  quality_risk: {
    label: 'Quality risk',
    tone: 'border-destructive/40 bg-destructive/10 text-destructive',
    icon: ShieldAlert,
    summary: 'Sells, but returns, ratings or cancellations are costing more than the sales are worth.',
  },
  underperforming: {
    label: 'Underperforming',
    tone: 'border-destructive/40 bg-destructive/10 text-destructive',
    icon: TrendingDown,
    summary: 'Few shoppers look at it and fewer buy - consider delisting or a relaunch.',
  },
  too_early: {
    label: 'Too early to judge',
    tone: 'border-border bg-muted text-muted-foreground',
    icon: Clock,
    summary: 'Not enough shopper traffic yet for a fair verdict.',
  },
};

const chartConfig = {
  views: { label: 'Views', color: 'var(--color-chart-1)' },
  carts: { label: 'Add to carts', color: 'var(--color-chart-2)' },
  orders: { label: 'Orders', color: 'var(--color-chart-4)' },
} satisfies ChartConfig;

const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
const num = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value.toLocaleString());

function monthLabel(month: string) {
  return formatDate(`${month}-01T00:00:00`, 'MMM yy');
}

/**
 * Life stats for one product: a "worth listing?" verdict with the reasons behind it,
 * a month-by-month view of attention vs. sales, the 90-day funnel and how it compares
 * with the rest of its category.
 */
export function ProductInsightsPanel({ productId }: { productId: string }) {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError } = useProductInsights(productId, months);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Performance data could not be loaded right now.</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Performance & listing health</h2>
          <p className="text-xs text-muted-foreground">
            Listed {formatDate(data.listedAt)} ({data.ageDays} days ago)
            {data.lifetime.trackingSince && ` · shopper activity tracked since ${formatDate(data.lifetime.trackingSince)}`}
          </p>
        </div>
        <Tabs value={String(months)} onValueChange={(value) => setMonths(Number(value))}>
          <TabsList>
            <TabsTrigger value="3">3 months</TabsTrigger>
            <TabsTrigger value="6">6 months</TabsTrigger>
            <TabsTrigger value="12">12 months</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {data.unavailable.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs">
          <CircleAlert className="size-4 shrink-0 text-status-warning" aria-hidden />
          Some figures are missing because a service did not answer: {data.unavailable.join(', ')}.
        </p>
      )}

      <VerdictCard insights={data} />
      <KpiTiles insights={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <MonthlyChart insights={data} />
        <Funnel insights={data} />
      </div>

      <MonthlyTable insights={data} />
    </div>
  );
}

function VerdictCard({ insights }: { insights: ProductInsights }) {
  const { health } = insights;
  const verdict = VERDICT[health.verdict];
  const Icon = verdict.icon;
  const subScores = [
    { key: 'Demand', value: health.scores.demand, hint: 'attention vs. category', weight: '35%' },
    { key: 'Conversion', value: health.scores.conversion, hint: 'views that become orders', weight: '40%' },
    { key: 'Quality', value: health.scores.quality, hint: 'returns, ratings, cancellations', weight: '25%' },
  ];

  return (
    <Card>
      <CardContent className="grid gap-6 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border ${verdict.tone}`}>
              {health.score === null ? (
                <Icon className="size-7" aria-hidden />
              ) : (
                <>
                  <span className="text-2xl font-bold leading-none tabular-nums">{health.score}</span>
                  <span className="text-[10px] font-medium opacity-80">/ 100</span>
                </>
              )}
            </div>
            <div>
              <Badge variant="outline" className={verdict.tone}>
                <Icon className="size-3.5" aria-hidden />
                {verdict.label}
              </Badge>
              <p className="mt-1.5 text-sm">{verdict.summary}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {subScores.map((score) => (
              <div key={score.key}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span>
                    <span className="font-medium">{score.key}</span>
                    <span className="text-muted-foreground"> · {score.hint} ({score.weight})</span>
                  </span>
                  <span className="tabular-nums">{score.value ?? '—'}</span>
                </div>
                <Progress value={score.value ?? 0} className="h-1.5" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Compared against {health.benchmarkUsed === 'category' ? `other ${insights.category.name ?? 'category'} products` : 'typical platform rates (category too small to compare)'}.
            50 = category average.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          {health.reasons.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
              <ul className="flex flex-col gap-1.5">
                {health.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {health.actions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to do</p>
              <ul className="flex flex-col gap-1.5">
                {health.actions.map((action) => (
                  <li key={action} className="flex gap-2">
                    <Wrench className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTiles({ insights }: { insights: ProductInsights }) {
  const { funnel90, health, stock, lifetime, category } = insights;
  const bench = category.benchmark;
  const trend = health.metrics.viewsTrendPct;
  const tiles = [
    {
      label: 'Views (90 days)',
      value: num(funnel90.views),
      sub:
        trend === null
          ? `${num(funnel90.viewers)} unique shoppers`
          : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(0)}% vs. previous 30 days`,
    },
    {
      label: 'Conversion (view → order)',
      value: pct(health.metrics.viewToOrderRate, 2),
      sub: bench?.viewToOrderRate ? `category avg ${pct(bench.viewToOrderRate, 2)}` : 'chance a viewer buys',
    },
    {
      label: 'Add-to-cart rate',
      value: pct(health.metrics.viewToCartRate),
      sub: bench?.viewToCartRate ? `category avg ${pct(bench.viewToCartRate)}` : 'views that reach the cart',
    },
    {
      label: 'Orders (90 days)',
      value: num(funnel90.orders),
      sub: funnel90.revenue === null ? '' : `${formatMoney(funnel90.revenue)} revenue`,
    },
    {
      label: 'Return rate',
      value: pct(health.metrics.returnRate),
      sub: health.metrics.cancelRate === null ? 'needs 5+ units sold' : `${pct(health.metrics.cancelRate)} cancelled`,
    },
    {
      label: 'Buyers (lifetime)',
      value: num(lifetime.buyers),
      sub: lifetime.repeatBuyers ? `${lifetime.repeatBuyers} bought again` : lifetime.lastSaleAt ? `last sale ${formatDate(lifetime.lastSaleAt)}` : 'no sales yet',
    },
    {
      label: 'In wishlists now',
      value: num(lifetime.savedNow),
      sub: 'shoppers waiting on it',
    },
    {
      label: 'Stock cover',
      value: health.metrics.daysOfStock === null ? num(stock?.available) : `${Math.round(health.metrics.daysOfStock)} days`,
      sub: stock ? `${stock.available.toLocaleString()} available · ${stock.reserved.toLocaleString()} reserved` : 'stock unavailable',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{tile.value}</p>
            {tile.sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{tile.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MonthlyChart({ insights }: { insights: ProductInsights }) {
  const data = insights.monthly.map((point) => ({ ...point, label: monthLabel(point.month) }));
  const empty = data.every((point) => !point.views && !point.orders && !point.carts);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm">Month by month</CardTitle>
        <CardDescription>Views and add-to-carts (bars) against orders (line)</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No shopper activity in this period yet.</div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="traffic" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
              <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="traffic" dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="traffic" dataKey="carts" fill="var(--color-carts)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="orders" dataKey="orders" type="monotone" stroke="var(--color-orders)" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function Funnel({ insights }: { insights: ProductInsights }) {
  const { funnel90, category } = insights;
  const views = funnel90.views ?? 0;
  const steps = [
    { label: 'Viewed', value: funnel90.views },
    { label: 'Added to cart', value: funnel90.carts },
    { label: 'Ordered', value: funnel90.orders },
  ];
  const bench = category.benchmark;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Funnel · last 90 days</CardTitle>
        <CardDescription>Out of every shopper view</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const share = views > 0 && step.value !== null ? step.value / views : null;
          return (
            <div key={step.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium">{step.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {num(step.value)}
                  {index > 0 && ` · ${pct(share)}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${index === 0 ? (views ? 100 : 0) : share ? Math.max(2, Math.min(100, share * 100)) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="mt-1 border-t pt-3 text-xs text-muted-foreground">
          {bench && bench.productsCompared >= 3 ? (
            <>
              <p>
                Category ({category.name}) avg: {pct(bench.viewToCartRate)} add to cart, {pct(bench.viewToOrderRate, 2)} order,{' '}
                {bench.avgViews === null ? '—' : Math.round(bench.avgViews).toLocaleString()} views per product.
              </p>
              {bench.viewsRank && (
                <p className="mt-1">
                  Ranks <span className="font-medium text-foreground">#{bench.viewsRank}</span> of {bench.productsInCategory} by views in its category.
                </p>
              )}
            </>
          ) : (
            <p>Not enough products with traffic in {category.name ?? 'this category'} to benchmark yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTable({ insights }: { insights: ProductInsights }) {
  const rows = [...insights.monthly].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Monthly breakdown</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              {['Month', 'Views', 'Shoppers', 'Carts', 'Wishlisted', 'Orders', 'Units', 'Revenue', 'Conversion', 'Returned', 'Cancelled'].map((head) => (
                <th key={head} className="py-2 pr-3 font-medium">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.month} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{monthLabel(row.month)}</td>
                <td className="py-2 pr-3">{row.views.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.viewers.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.carts.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.wishlistSaves.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.orders.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.units.toLocaleString()}</td>
                <td className="py-2 pr-3">{formatMoney(row.revenue)}</td>
                <td className="py-2 pr-3">{pct(row.conversionRate, 2)}</td>
                <td className="py-2 pr-3">{row.returnedUnits.toLocaleString()}</td>
                <td className="py-2 pr-3">{row.cancelledUnits.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
