import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Addresses' };

/** Placeholder until the user service address endpoints are wired via features/address. */
export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold md:text-[32px]">Addresses</h1>
      <EmptyState
        icon={MapPin}
        title="No saved addresses"
        description="Save a delivery address to speed up checkout."
        action={<Button disabled>Add address</Button>}
      />
    </div>
  );
}
