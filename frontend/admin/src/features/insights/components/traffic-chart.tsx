'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import type { Engagement } from '../types';

const chartConfig = {
  views: { label: 'Product views', color: 'var(--color-chart-1)' },
  searches: { label: 'Searches', color: 'var(--color-chart-2)' },
} satisfies ChartConfig;

/** Daily product views vs. searches across the selected range. */
export function TrafficChart({
  series,
  isLoading,
}: {
  series: Engagement['series'];
  isLoading?: boolean;
}) {
  const data = series.map((point) => ({ ...point, label: formatDate(point.date, 'd MMM') }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Shopper activity per day</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                {(['views', 'searches'] as const).map((key) => (
                  <linearGradient key={key} id={`traffic-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={2} fill="url(#traffic-views)" />
              <Area
                dataKey="searches"
                type="monotone"
                stroke="var(--color-searches)"
                strokeWidth={2}
                fill="url(#traffic-searches)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
