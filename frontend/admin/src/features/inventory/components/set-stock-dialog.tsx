'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpsertStock, useWarehouses } from '../hooks/use-inventory';

interface SetStockDialogProps {
  vendorId: string;
  productId: string;
  variantId: string;
  sku: string;
  variantLabel: string;
  onClose: () => void;
}

/**
 * Sets absolute stock for one variant at one warehouse — the first-stocking
 * form the product detail page needs, which `features/inventory`'s existing
 * quick-adjust dialog can't do (it only moves stock by a delta on a SKU that
 * already has a stock row). Opened with real productId/variantId/sku already
 * in hand from the product detail page, so there's no picker to get wrong.
 */
export function SetStockDialog({
  vendorId,
  productId,
  variantId,
  sku,
  variantLabel,
  onClose,
}: SetStockDialogProps) {
  const warehouses = useWarehouses();
  const upsert = useUpsertStock();
  const [warehouseId, setWarehouseId] = useState('');
  const [onHand, setOnHand] = useState('');
  const [reorderLevel, setReorderLevel] = useState('10');

  const onHandNumber = Number(onHand);
  const canSubmit = Boolean(warehouseId) && Number.isInteger(onHandNumber) && onHandNumber >= 0;

  function submit() {
    upsert.mutate(
      {
        vendorId,
        productId,
        variantId,
        sku,
        warehouseId,
        onHand: onHandNumber,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set stock</DialogTitle>
          <DialogDescription>
            {variantLabel} <span className="font-mono text-xs">({sku})</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="warehouseId">Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger id="warehouseId" className="mt-1.5 w-full">
                <SelectValue placeholder="Choose a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.data?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="onHand">Units in stock</Label>
              <Input
                id="onHand"
                type="number"
                min={0}
                className="mt-1.5"
                value={onHand}
                onChange={(event) => setOnHand(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reorderLevel">Reorder level</Label>
              <Input
                id="reorderLevel"
                type="number"
                min={0}
                className="mt-1.5"
                value={reorderLevel}
                onChange={(event) => setReorderLevel(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || upsert.isPending} onClick={submit}>
            {upsert.isPending ? 'Saving…' : 'Set stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
