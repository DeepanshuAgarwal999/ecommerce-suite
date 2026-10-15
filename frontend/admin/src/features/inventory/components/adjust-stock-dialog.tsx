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
import { Textarea } from '@/components/ui/textarea';
import { useAdjustStock } from '../hooks/use-inventory';

interface AdjustStockDialogProps {
  sku: string;
  warehouseId: string;
  warehouseName: string;
  currentOnHand: number;
  onClose: () => void;
}

/**
 * Relative adjustment only — a restock, a damage write-off, a count
 * correction. The console never sets `onHand` to an absolute number for a
 * SKU already in circulation: that is what `inventory.adjust` enforces
 * server-side (conditional UPDATE, never below what is already reserved).
 */
export function AdjustStockDialog({
  sku,
  warehouseId,
  warehouseName,
  currentOnHand,
  onClose,
}: AdjustStockDialogProps) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAdjustStock();

  const parsedDelta = Number(delta);
  const valid = delta.trim() !== '' && Number.isInteger(parsedDelta) && parsedDelta !== 0;
  const projected = valid ? currentOnHand + parsedDelta : currentOnHand;

  function submit() {
    if (!valid) return;
    adjust.mutate(
      { sku, warehouseId, delta: parsedDelta, reason: reason || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {sku} · {warehouseName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delta">Quantity change</Label>
            <Input
              id="delta"
              type="number"
              step={1}
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="e.g. 50 to receive stock, -5 to write off"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Currently {currentOnHand.toLocaleString()} on hand → {projected.toLocaleString()} after this change.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjust-reason">Reason (optional)</Label>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Inbound PO #4821, damaged in transit"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || adjust.isPending} onClick={submit}>
            {adjust.isPending ? 'Saving…' : 'Apply adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
