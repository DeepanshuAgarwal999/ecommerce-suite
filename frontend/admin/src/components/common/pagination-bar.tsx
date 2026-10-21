'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from 'cn';
import type { PaginationMeta } from '@/types/pagination';

export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** 1 … 4 5 [6] 7 8 … 20 - always first, last, and two either side of the current page. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });
  return result;
}

interface PaginationBarProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  disabled?: boolean;
}

/** Server-side pagination controls: range summary, page size, numbered pages. */
export function PaginationBar({ meta, onPageChange, onPageSizeChange, disabled }: PaginationBarProps) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const go = (page: number) => {
    if (page !== meta.page && page >= 1 && page <= meta.totalPages) onPageChange(page);
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground tabular-nums">{from.toLocaleString()}</span>–
          <span className="font-medium text-foreground tabular-nums">{to.toLocaleString()}</span> of{' '}
          <span className="font-medium text-foreground tabular-nums">{meta.total.toLocaleString()}</span>
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            Rows
            <Select value={String(meta.limit)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger size="sm" className="h-7 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" disabled={disabled || !meta.hasPrevious} onClick={() => go(1)} aria-label="First page">
            <ChevronsLeft className="size-4" aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" disabled={disabled || !meta.hasPrevious} onClick={() => go(meta.page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          {pageWindow(meta.page, meta.totalPages).map((page, index) =>
            page === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={page}
                type="button"
                variant={page === meta.page ? 'default' : 'ghost'}
                size="icon-sm"
                disabled={disabled}
                aria-current={page === meta.page ? 'page' : undefined}
                aria-label={`Page ${page}`}
                className={cn('tabular-nums', page >= 100 && 'w-auto px-2')}
                onClick={() => go(page)}
              >
                {page}
              </Button>
            ),
          )}
          <Button type="button" variant="outline" size="icon-sm" disabled={disabled || !meta.hasNext} onClick={() => go(meta.page + 1)} aria-label="Next page">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" disabled={disabled || !meta.hasNext} onClick={() => go(meta.totalPages)} aria-label="Last page">
            <ChevronsRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}
