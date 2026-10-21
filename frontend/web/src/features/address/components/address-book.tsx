'use client';

import { useState } from 'react';
import { LogIn, MapPin, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { useOpenLogin } from '@/features/auth/hooks/use-require-auth';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../hooks/use-addresses';
import { addressTitle, type Address } from '../types';
import { AddressCard } from './address-card';
import { AddressDialog } from './address-dialog';

/** Account -> Addresses: list, add, edit, delete, make default. */
export function AddressBook() {
  const isSignedIn = useIsSignedIn();
  const openLogin = useOpenLogin();
  const { data: addresses, isPending } = useAddresses();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={LogIn}
        title="Sign in to see your addresses"
        description="Saved addresses make checkout a one-tap affair."
        action={<Button onClick={openLogin}>Sign in</Button>}
      />
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-primary h-12 justify-start gap-2 border-dashed"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-4" /> Add a new address
      </Button>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : !addresses?.length ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses yet"
          description="Add your home, work or any other address to check out faster."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => setEditing(address)}
              onDelete={() => setDeleting(address)}
              onSetDefault={() => setDefault.mutate(address.id)}
            />
          ))}
        </div>
      )}

      <AddressDialog open={adding} onOpenChange={setAdding} />
      <AddressDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} address={editing} />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this address?</DialogTitle>
            <DialogDescription>
              {deleting && `Your ${addressTitle(deleting)} address (${deleting.city} - ${deleting.pincode}) will be removed.`}
              {deleting?.isDefault && ' Another saved address will become your default.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
