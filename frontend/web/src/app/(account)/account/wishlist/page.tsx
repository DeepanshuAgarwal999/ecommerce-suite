import type { Metadata } from 'next';
import { WishlistView } from '@/features/wishlist/components/wishlist-view';

export const metadata: Metadata = { title: 'Wishlist' };

export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold md:text-[32px]">Wishlist</h1>
      <WishlistView />
    </div>
  );
}
