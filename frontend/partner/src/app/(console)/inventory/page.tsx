'use client';

import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdjustStockDialog } from '@/features/inventory/components/adjust-stock-dialog';
import { useLowStock, useWarehouses } from '@/features/inventory/hooks/use-inventory';

export default function InventoryPage() {
  const lowStock = useLowStock();
  const warehouses = useWarehouses();
  const warehouseName = (id: string) => warehouses.data?.find((w) => w.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="SKUs at or below their reorder point, across every warehouse you stock."
        action={<AdjustStockDialog />}
      />

      {lowStock.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (lowStock.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nothing is running low"
          description="Every SKU is above its reorder level."
        />
      ) : (
        <div className="scrollbar-none overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reorder level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.data?.map((row) => (
                <TableRow key={`${row.sku}-${row.warehouseId}`}>
                  <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                  <TableCell>{warehouseName(row.warehouseId)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.available <= 0
                          ? 'border-transparent bg-[oklch(0.95_0.03_27)] text-destructive font-bold'
                          : 'border-transparent bg-[oklch(0.96_0.04_85)] text-[oklch(0.5_0.14_70)] font-bold'
                      }
                    >
                      {row.available}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.reorderLevel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
