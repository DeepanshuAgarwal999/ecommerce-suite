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
import { Switch } from '@/components/ui/switch';
import { useCreateColumn, useUpdateColumn } from '../hooks/use-footer';
import type { FooterColumn, FooterColumnInput } from '../types';

interface ColumnFormDialogProps {
  column: FooterColumn | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function ColumnFormDialog({ column, mode, onClose }: ColumnFormDialogProps) {
  const [title, setTitle] = useState(column?.title ?? '');
  const [isActive, setIsActive] = useState(column?.isActive ?? true);

  const create = useCreateColumn();
  const update = useUpdateColumn();
  const isPending = create.isPending || update.isPending;
  const valid = title.trim() !== '';

  function submit() {
    const input: FooterColumnInput = { title, isActive };
    if (mode === 'create') {
      create.mutate(input, { onSuccess: onClose });
    } else if (column) {
      update.mutate({ id: column.id, input }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New footer column' : 'Edit column'}</DialogTitle>
          <DialogDescription>
            A link group in the footer — "Bedroom Decor", "Policies", "Get in Touch".
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="column-title">Column title</Label>
            <Input
              id="column-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Bedroom Decor"
              autoFocus
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || isPending} onClick={submit}>
            {isPending ? 'Saving…' : mode === 'create' ? 'Create column' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
