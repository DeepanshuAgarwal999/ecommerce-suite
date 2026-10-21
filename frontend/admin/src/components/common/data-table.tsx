'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import { Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaginationMeta } from '@/types/pagination';
import { PaginationBar } from './pagination-bar';

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  /** Shows a rows-per-page picker when given. */
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: T) => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  emptyLabel?: string;
}

/**
 * Server-paginated table shared by every list page in the console. Sorting
 * and filtering happen server-side (the gateway endpoints already accept
 * page/limit/q/status) — this component only renders what it is given and
 * reports the page the caller asks for next.
 */
export function DataTable<T>({
  columns,
  data,
  meta,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  sorting,
  onSortingChange,
  emptyLabel = 'Nothing to show yet.',
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: Boolean(onSortingChange),
    state: sorting ? { sorting } : undefined,
    onSortingChange,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }, (_, index) => (
                <TableRow key={index} className="hover:bg-transparent">
                  {columns.map((_, columnIndex) => (
                    <TableCell key={columnIndex}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="size-6" aria-hidden />
                    <span className="text-sm">{emptyLabel}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && onPageChange && (
        <PaginationBar
          meta={meta}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={isLoading}
        />
      )}
    </div>
  );
}
