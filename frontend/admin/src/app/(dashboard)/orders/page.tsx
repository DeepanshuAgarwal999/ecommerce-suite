'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/common/data-table';
import { ExportButton } from '@/components/common/export-button';
import { ListToolbar } from '@/components/common/list-toolbar';
import { StatusBadge } from '@/components/common/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildOrdersExport } from '@/features/orders/export';
import { useOrders } from '@/features/orders/hooks/use-orders';
import type { OrderListItem, OrderStatus } from '@/features/orders/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatDateTime, formatMoney } from '@/lib/format';

const STATUS_OPTIONS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RETURN_REQUESTED', label: 'Return requested' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const columns: ColumnDef<OrderListItem>[] = [
  {
    accessorKey: 'orderNumber',
    header: 'Order',
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-sm font-medium">{row.original.orderNumber}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.items.length} item{row.original.items.length === 1 ? '' : 's'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'userMobile',
    header: 'Customer',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.userMobile}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'source',
    header: 'Channel',
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.source}</span>,
  },
  {
    accessorKey: 'grandTotal',
    header: 'Total',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatMoney(row.original.grandTotal)}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Placed',
    cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
  },
];

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = {
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    status: status === 'ALL' ? undefined : status,
  };
  const { data, isLoading, isFetching } = useOrders(query);

  return (
    <>
      <PageHeader title="Orders" description="Every order on the platform, across every vendor." />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search order number or mobile…"
      >
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
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
          filenameBase="orders"
          onBuild={() => buildOrdersExport({ q: query.q, status: query.status })}
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        onRowClick={(order) => router.push(`/orders/${order.id}`)}
        emptyLabel="No orders match these filters."
      />
    </>
  );
}
