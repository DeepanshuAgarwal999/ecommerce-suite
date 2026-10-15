'use client';

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, PenSquare, Warehouse as WarehouseIcon } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { ListToolbar } from '@/components/common/list-toolbar';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdjustStockDialog } from '@/features/inventory/components/adjust-stock-dialog';
import { useLowStock, useStock, useWarehouses } from '@/features/inventory/hooks/use-inventory';
import type { StockItem } from '@/features/inventory/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock levels across every warehouse and vendor, plus the reorder queue."
      />

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="low-stock">Low stock</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <StockTab />
        </TabsContent>
        <TabsContent value="low-stock" className="mt-4">
          <LowStockTab />
        </TabsContent>
        <TabsContent value="warehouses" className="mt-4">
          <WarehousesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StockTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);

  const { data, isLoading, isFetching } = useStock({
    page,
    limit: 20,
    q: debouncedSearch || undefined,
  });

  const columns: ColumnDef<StockItem>[] = [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>,
    },
    {
      accessorKey: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.warehouse.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.warehouse.code}</p>
        </div>
      ),
    },
    {
      accessorKey: 'onHand',
      header: 'On hand',
      cell: ({ row }) => <span className="tabular-nums">{row.original.onHand.toLocaleString()}</span>,
    },
    {
      accessorKey: 'reserved',
      header: 'Reserved',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.reserved.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'available',
      header: 'Available',
      cell: ({ row }) => {
        const low = row.original.available <= row.original.reorderLevel;
        return (
          <span className={`tabular-nums font-medium ${low ? 'text-status-warning' : ''}`}>
            {row.original.available.toLocaleString()}
            {low && <AlertTriangle className="ml-1 inline size-3.5" aria-label="Below reorder level" />}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            setAdjusting(row.original);
          }}
          aria-label="Adjust stock"
        >
          <PenSquare className="size-4" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by SKU…"
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        emptyLabel="No stock records match this search."
      />

      {adjusting && (
        <AdjustStockDialog
          sku={adjusting.sku}
          warehouseId={adjusting.warehouse.id}
          warehouseName={adjusting.warehouse.name}
          currentOnHand={adjusting.onHand}
          onClose={() => setAdjusting(null)}
        />
      )}
    </>
  );
}

function LowStockTab() {
  const { data, isLoading } = useLowStock();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <AlertTriangle className="size-6" aria-hidden />
          <p className="text-sm">Nothing is below its reorder level right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data.length} SKU{data.length === 1 ? '' : 's'} at or below reorder level
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reorder level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={`${row.sku}-${row.warehouseId}`} className="hover:bg-transparent">
                <TableCell className="font-mono">{row.sku}</TableCell>
                <TableCell className="text-muted-foreground">{row.warehouseId.slice(0, 8)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-status-warning/40 bg-status-warning/10 text-status-warning">
                    {row.available}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{row.reorderLevel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WarehousesTab() {
  const { data, isLoading } = useWarehouses();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data?.map((warehouse) => (
        <Card key={warehouse.id}>
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-sm">{warehouse.name}</CardTitle>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{warehouse.code}</p>
            </div>
            <WarehouseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{warehouse.type.replace(/_/g, ' ')}</span>
            <span>
              {warehouse.city}, {warehouse.state} · {warehouse.pincode}
            </span>
            <Badge variant={warehouse.isActive ? 'outline' : 'secondary'} className="mt-1 w-fit">
              {warehouse.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
