'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileSpreadsheet, Package, Plus, X } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { ExportButton } from '@/components/common/export-button';
import { ListToolbar } from '@/components/common/list-toolbar';
import { PAGE_SIZES } from '@/components/common/pagination-bar';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildProductsExport } from '@/features/products/export';
import { useCategories, useProducts } from '@/features/products/hooks/use-products';
import { ImportProductsDialog } from '@/features/products/import/import-products-dialog';
import type { AdminProductListItem, ProductListQuery, ProductListSort, ProductStatus } from '@/features/products/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatMoney } from '@/lib/format';

const STATUS_OPTIONS: { value: ProductStatus | 'ALL' | 'LIVE'; label: string }[] = [
  { value: 'LIVE', label: 'All except drafts' },
  { value: 'ALL', label: 'All incl. drafts' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
];

const SORT_OPTIONS: { value: ProductListSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'title', label: 'Name A–Z' },
];

const ALL_CATEGORIES = '__all__';

const columns: ColumnDef<AdminProductListItem>[] = [
  {
    accessorKey: 'title',
    header: 'Product',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {row.original.media[0] ? (
            // Vendor-supplied image hosts aren't known ahead of time, so a plain <img>
            // avoids the next/image remote-domain allowlist for this internal tool.
            <img src={row.original.media[0].url} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Package className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.variants.length} variant(s)
            {row.original.variants[0]?.sku && <span className="font-mono"> · {row.original.variants[0].sku}</span>}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'vendorName',
    header: 'Vendor',
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {row.original.vendorName}
        {row.original.source === 'ADMIN_WEB' && (
          <Badge variant="outline" className="text-[10px]">
            Staff-listed
          </Badge>
        )}
        {row.original.externalSource === 'EXCEL_IMPORT' && (
          <Badge variant="outline" className="text-[10px]">
            Imported
          </Badge>
        )}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'minPrice',
    header: 'Price',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatMoney(row.original.minPrice)}
        {row.original.maxPrice !== row.original.minPrice && (
          <span className="text-muted-foreground"> – {formatMoney(row.original.maxPrice)}</span>
        )}
      </span>
    ),
  },
  {
    accessorKey: 'soldCount',
    header: 'Sold',
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.soldCount}</span>,
  },
  {
    accessorKey: 'ratingAverage',
    header: 'Rating',
    cell: ({ row }) =>
      row.original.ratingCount > 0 ? (
        <span className="tabular-nums">
          {row.original.ratingAverage.toFixed(1)}{' '}
          <span className="text-xs text-muted-foreground">({row.original.ratingCount})</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

/**
 * Every product across every vendor. All list state (search, filters, sort, page,
 * page size) lives in the URL, so refresh, back/forward and shared links keep it.
 */
export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const categories = useCategories();
  const [importOpen, setImportOpen] = useState(false);

  const page = Math.max(1, Number(params.get('page')) || 1);
  const limitParam = Number(params.get('limit'));
  const limit = (PAGE_SIZES as readonly number[]).includes(limitParam) ? limitParam : 20;
  const status = (params.get('status') as ProductStatus | 'ALL' | null) ?? 'LIVE';
  const sort = (params.get('sort') as ProductListSort | null) ?? 'updated';
  const categoryId = params.get('categoryId') ?? undefined;
  const vendorId = params.get('vendorId') ?? undefined;

  /** Replace some URL params; any filter change resets to page 1. */
  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete('page');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Search box is local for instant typing; the debounced value goes to the URL.
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedSearch) update({ q: debouncedSearch || undefined });
  }, [debouncedSearch, params, update]);

  const query: ProductListQuery = {
    page,
    limit,
    q: params.get('q') || undefined,
    status: status === ('LIVE' as string) ? undefined : (status as ProductStatus | 'ALL'),
    sort,
    categoryId,
    vendorId,
  };
  const { data, isLoading, isFetching } = useProducts(query);

  return (
    <>
      <PageHeader
        title="Products"
        description="Every listing across every vendor — review queue, live catalogue, and anything archived."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" aria-hidden />
              Import from Excel
            </Button>
            <Button onClick={() => router.push('/products/new')}>
              <Plus className="size-4" aria-hidden />
              List a product
            </Button>
          </div>
        }
      />

      {vendorId && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          <span>Filtered to one vendor</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => update({ vendorId: undefined })}
            aria-label="Clear vendor filter"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}

      <ListToolbar search={search} onSearchChange={setSearch} placeholder="Search title, vendor or SKU…">
        <Select value={status} onValueChange={(value) => update({ status: value === 'LIVE' ? undefined : value })}>
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryId ?? ALL_CATEGORIES}
          onValueChange={(value) => update({ categoryId: value === ALL_CATEGORIES ? undefined : value })}
        >
          <SelectTrigger className="w-48" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.data?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => update({ sort: value === 'updated' ? undefined : value })}>
          <SelectTrigger className="w-44" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportButton
          filenameBase="products"
          onBuild={() =>
            buildProductsExport({ q: query.q, status: query.status, vendorId, categoryId, sort })
          }
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={(next) => update({ page: next === 1 ? undefined : String(next) }, false)}
        onPageSizeChange={(size) => update({ limit: size === 20 ? undefined : String(size) })}
        onRowClick={(product) => router.push(`/products/${product.id}`)}
        emptyLabel="No products match these filters."
      />

      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
