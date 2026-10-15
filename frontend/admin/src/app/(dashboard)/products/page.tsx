'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Package, Plus, X } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { ExportButton } from '@/components/common/export-button';
import { ListToolbar } from '@/components/common/list-toolbar';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildProductsExport } from '@/features/products/export';
import { useProducts } from '@/features/products/hooks/use-products';
import type { AdminProductListItem, ProductStatus } from '@/features/products/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatMoney } from '@/lib/format';

const STATUS_OPTIONS: { value: ProductStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
];

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
          <p className="text-xs text-muted-foreground">{row.original.variants.length} variant(s)</p>
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

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendorId') ?? undefined;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = {
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    status: status === 'ALL' ? undefined : status,
    vendorId,
  };
  const { data, isLoading, isFetching } = useProducts(query);

  return (
    <>
      <PageHeader
        title="Products"
        description="Every listing across every vendor — review queue, live catalogue, and anything archived."
        actions={
          <Button onClick={() => router.push('/products/new')}>
            <Plus className="size-4" aria-hidden />
            List a product
          </Button>
        }
      />

      {vendorId && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          <span>Filtered to one vendor</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => router.push('/products')}
            aria-label="Clear vendor filter"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search title, vendor or SKU…"
      >
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ProductStatus | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
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
        <ExportButton
          filenameBase="products"
          onBuild={() =>
            buildProductsExport({ q: query.q, status: query.status, vendorId: query.vendorId })
          }
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        onRowClick={(product) => router.push(`/products/${product.id}`)}
        emptyLabel="No products match these filters."
      />
    </>
  );
}
