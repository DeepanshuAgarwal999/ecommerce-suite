'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isApiError } from '@/lib/api';
import { useAdjustStock, useWarehouses } from '../hooks/use-inventory';

/**
 * Quick +/- stock correction by SKU — "50 more arrived", "3 were damaged".
 * Listing a brand-new SKU at a brand-new warehouse needs the product's
 * variant id and isn't covered by this quick form; that happens from the
 * product edit screen once per-warehouse stock entry ships there.
 */
export function AdjustStockDialog({ defaultSku }: { defaultSku?: string }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState(defaultSku ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [delta, setDelta] = useState('');
  const warehouses = useWarehouses();
  const adjust = useAdjustStock();
  const skuId = useId();
  const deltaId = useId();

  const deltaNumber = Number(delta);
  const canSubmit = sku.trim().length > 0 && warehouseId && Number.isInteger(deltaNumber) && deltaNumber !== 0;

  function submit() {
    adjust.mutate(
      { sku: sku.trim(), warehouseId, delta: deltaNumber },
      {
        onSuccess: () => {
          toast.success('Stock updated');
          setOpen(false);
          setDelta('');
        },
        onError: (error) => {
          toast.error(isApiError(error) ? error.message : 'Could not update stock. Try again.');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Adjust stock</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Positive adds stock, negative removes it — e.g. <code>50</code> or <code>-3</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={skuId}>SKU</FieldLabel>
            <Input id={skuId} value={sku} onChange={(e) => setSku(e.target.value)} />
          </Field>

          <Field>
            <FieldLabel>Warehouse</FieldLabel>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.data?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={deltaId}>Quantity change</FieldLabel>
            <Input
              id={deltaId}
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 50 or -3"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button disabled={!canSubmit || adjust.isPending} onClick={submit}>
            {adjust.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
