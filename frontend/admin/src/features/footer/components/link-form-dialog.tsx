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
import { useCreateLink, useUpdateLink } from '../hooks/use-footer';
import type { FooterLink, FooterLinkInput } from '../types';

interface LinkFormDialogProps {
  columnId: string;
  link: FooterLink | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function LinkFormDialog({ columnId, link, mode, onClose }: LinkFormDialogProps) {
  const [label, setLabel] = useState(link?.label ?? '');
  const [href, setHref] = useState(link?.href ?? '');
  const [isActive, setIsActive] = useState(link?.isActive ?? true);

  const create = useCreateLink(columnId);
  const update = useUpdateLink(columnId);
  const isPending = create.isPending || update.isPending;
  const valid = label.trim() !== '' && href.trim() !== '';

  function submit() {
    const input: FooterLinkInput = { label, href, isActive };
    if (mode === 'create') {
      create.mutate(input, { onSuccess: onClose });
    } else if (link) {
      update.mutate({ linkId: link.id, input }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add a link' : 'Edit link'}</DialogTitle>
          <DialogDescription>One row in this footer column.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-label">Label</Label>
            <Input
              id="link-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Bedsheets"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-href">Links to</Label>
            <Input
              id="link-href"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="/c/bedsheets"
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
            {isPending ? 'Saving…' : mode === 'create' ? 'Add link' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
