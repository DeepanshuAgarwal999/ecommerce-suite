'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, LogIn, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { useOpenLogin } from '@/features/auth/hooks/use-require-auth';
import { formatPrice } from '@/lib/utils/format';
import { useToggleWishlist, useWishlist } from '../hooks/use-wishlist';
import type { WishlistItem } from '../types';

export function WishlistView() {
  const isSignedIn = useIsSignedIn();
  const openLogin = useOpenLogin();

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={LogIn}
        title="Sign in to see your wishlist"
        description="Items you save show up here, from any device."
        action={<Button onClick={openLogin}>Sign in</Button>}
      />
    );
  }

  return <SignedInWishlist />;
}

function SignedInWishlist() {
  const { data, isPending, isError, refetch } = useWishlist();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Heart}
        title="Could not load your wishlist"
        description="Check your connection and try again."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap the heart on anything you like the look of — it'll show up here."
        action={
          <Button asChild>
            <Link href="/">Start browsing</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((item) => (
        <WishlistCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function WishlistCard({ item }: { item: WishlistItem }) {
  const toggle = useToggleWishlist();

  return (
    <article className="group bg-card flex flex-col overflow-hidden rounded-[14px] border">
      <div className="bg-secondary relative aspect-square">
        <Link href={`/p/${item.productId}`} className="absolute inset-0 block overflow-hidden">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : null}
        </Link>
        <button
          type="button"
          aria-label={`Remove ${item.title} from wishlist`}
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate({
              productId: item.productId,
              variantId: item.variantId ?? undefined,
              title: item.title,
              imageUrl: item.imageUrl ?? undefined,
              priceAtSave: item.priceAtSave,
            })
          }
          className="bg-card absolute top-2 right-2 z-10 grid size-9 place-items-center rounded-full shadow-[0_1px_4px_oklch(0.2_0.05_330/0.15)] transition-transform hover:scale-105 disabled:opacity-60"
        >
          <Trash2 className="text-destructive size-[17px]" strokeWidth={1.9} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-2.5">
        <Link href={`/p/${item.productId}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm leading-[1.35] font-semibold">{item.title}</h3>
        </Link>
        <p className="mt-auto text-sm font-bold">{formatPrice(item.priceAtSave)}</p>
      </div>
    </article>
  );
}
