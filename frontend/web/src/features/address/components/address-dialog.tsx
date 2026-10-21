'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Address } from '../types';
import { AddressForm } from './address-form';

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing; null/undefined = add new. */
  address?: Address | null;
  onSaved?: (address: Address) => void;
  submitLabel?: string;
}

/** Add / edit address in a dialog - full height on phones, centred on desktop. */
export function AddressDialog({ open, onOpenChange, address, onSaved, submitLabel }: AddressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[92dvh] sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>{address ? 'Edit address' : 'Add a new address'}</DialogTitle>
          <DialogDescription>Use your location for speed, or type it in.</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-5 pt-4 pb-3">
          {/* Re-keyed so switching between addresses resets the form. */}
          <AddressForm
            key={address?.id ?? 'new'}
            address={address}
            submitLabel={submitLabel}
            onCancel={() => onOpenChange(false)}
            onSaved={(saved) => {
              onSaved?.(saved);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
