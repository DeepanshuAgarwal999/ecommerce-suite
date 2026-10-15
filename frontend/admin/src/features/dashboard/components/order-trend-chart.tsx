'use client';

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderTrendPoint } from '../api/dashboard-api';

const chartConfig = {
  orders: { label: 'Orders', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function OrderTrendChart({ data, isLoading }: { data: OrderTrendPoint[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Orders placed, last 14 days</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="orderTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-orders)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-orders)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="orders"
                type="monotone"
                stroke="var(--color-orders)"
                strokeWidth={2}
                fill="url(#orderTrendFill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
