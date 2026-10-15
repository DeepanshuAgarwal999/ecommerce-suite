'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DataTable } from '@/components/common/data-table';
import { ExportButton } from '@/components/common/export-button';
import { ListToolbar } from '@/components/common/list-toolbar';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildVendorsExport } from '@/features/vendors/export';
import { useVendors } from '@/features/vendors/hooks/use-vendors';
import type { VendorStatus, VendorWithUser } from '@/features/vendors/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS: { value: VendorStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const columns: ColumnDef<VendorWithUser>[] = [
  {
    accessorKey: 'businessName',
    header: 'Business',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {row.original.businessName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.businessName}</p>
          <p className="text-xs text-muted-foreground">{row.original.vendorCode}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'user',
    header: 'Contact',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.user?.mobile ?? row.original.supportPhone ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'ratingAverage',
    header: 'Rating',
    cell: ({ row }) =>
      row.original.ratingCount > 0 ? (
        <span className="flex items-center gap-1 tabular-nums">
          <Star className="size-3.5 fill-status-warning text-status-warning" aria-hidden />
          {row.original.ratingAverage.toFixed(1)}
          <span className="text-xs text-muted-foreground">({row.original.ratingCount})</span>
        </span>
      ) : (
        <span className="text-muted-foreground">No ratings</span>
      ),
  },
  {
    accessorKey: 'commissionBps',
    header: 'Commission',
    cell: ({ row }) => <span className="tabular-nums">{(row.original.commissionBps / 100).toFixed(1)}%</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Applied',
    cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
];

export default function VendorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VendorStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = {
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    status: status === 'ALL' ? undefined : status,
  };
  const { data, isLoading, isFetching } = useVendors(query);

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Seller applications, approvals and the commission rate each one is settled at."
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search business name, code or GSTIN…"
      >
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as VendorStatus | 'ALL');
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
          filenameBase="vendors"
          onBuild={() => buildVendorsExport({ q: query.q, status: query.status })}
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        onRowClick={(vendor) => router.push(`/vendors/${vendor.id}`)}
        emptyLabel="No vendors match these filters."
      />
    </>
  );
}
