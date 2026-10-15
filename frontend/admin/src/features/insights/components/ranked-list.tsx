import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from 'cn';

export interface RankedRow {
  key: string;
  label: string;
  href?: string;
  imageUrl?: string | null;
  /** Drives the share bar - relative to the top row. */
  value: number;
  /** Formatted primary figure, e.g. "1,240 views". */
  valueLabel: string;
  /** Extra right-hand detail, e.g. "12 orders · 1.0%". */
  meta?: ReactNode;
}

interface RankedListProps {
  title: string;
  description?: string;
  rows: RankedRow[];
  isLoading?: boolean;
  /** Set when the owning service was unreachable. */
  error?: string;
  emptyText: string;
  /** Show product thumbnails (off for search-term lists). */
  thumbnails?: boolean;
  /** Bar colour - e.g. destructive for "searches with no results". */
  tone?: 'primary' | 'warning';
  limit?: number;
  className?: string;
}

/**
 * A top-N leaderboard card: rank, optional thumbnail, label, figure and a
 * share bar scaled to the leader, so the gap between #1 and #10 reads at a
 * glance. Used for every list on the Insights page and the dashboard widget.
 */
export function RankedList({
  title,
  description,
  rows,
  isLoading,
  error,
  emptyText,
  thumbnails,
  tone = 'primary',
  limit = 10,
  className,
}: RankedListProps) {
  const visible = rows.slice(0, limit);
  const max = Math.max(1, ...visible.map((row) => row.value));

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-destructive" aria-hidden />
            Couldn&apos;t load this panel right now ({error}).
          </p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {visible.map((row, index) => {
              const label = (
                <span className="block truncate text-sm font-medium">{row.label}</span>
              );
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums',
                      index < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  {thumbnails && (
                    <span className="size-9 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {row.imageUrl && (
                        <img src={row.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      {row.href ? (
                        <Link href={row.href} className="min-w-0 hover:text-primary hover:underline">
                          {label}
                        </Link>
                      ) : (
                        <span className="min-w-0">{label}</span>
                      )}
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{row.valueLabel}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', tone === 'warning' ? 'bg-status-warning' : 'bg-primary')}
                          style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                        />
                      </div>
                      {row.meta && (
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{row.meta}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
