'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusCount } from '../api/dashboard-api';

const chartConfig = {
  count: { label: 'Count', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function StatusBreakdownChart({
  title,
  data,
  isLoading,
}: {
  title: string;
  data: StatusCount[];
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="status"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
