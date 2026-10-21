import type { Metadata } from 'next';
import { AddressBook } from '@/features/address/components/address-book';

export const metadata: Metadata = { title: 'Addresses' };

export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold md:text-[32px]">Saved addresses</h1>
        <p className="text-muted-foreground mt-1 text-sm">Home, work and anywhere else you get deliveries.</p>
      </div>
      <AddressBook />
    </div>
  );
}
