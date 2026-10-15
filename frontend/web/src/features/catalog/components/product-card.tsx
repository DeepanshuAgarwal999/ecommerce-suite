import Image from 'next/image';
import Link from 'next/link';
import { Price } from '@/components/common/price';
import { RatingBadge } from '@/components/common/rating-badge';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';
import { cn } from '@/lib/utils';
import { discountPercent, formatPackSize } from '@/lib/utils/format';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  className?: string;
  /** How wide the card's image actually renders at each breakpoint - callers
   *  in a fixed-width rail (ProductRail) must override the grid default below,
   *  or Next requests an image sized for a much wider slot than it displays. */
  sizes?: string;
}

/**
 * Server component by design — only the wishlist heart and the add-to-cart
 * control are interactive, so a grid of 40 tiles ships almost no JavaScript.
 */
export function ProductCard({
  product,
  className,
  sizes = '(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw',
}: ProductCardProps) {
  const off = discountPercent(product.mrpPaise, product.pricePaise);
  const variant =
    product.variantLabel ??
    (product.packSize
      ? formatPackSize(product.packSize.value, product.packSize.unit)
      : undefined);

  return (
    <article
      className={cn(
        'group bg-card flex flex-col overflow-hidden rounded-[14px] border transition-shadow hover:shadow-[0_8px_24px_oklch(0.42_0.21_330/0.12)]',
        className,
      )}
    >
      <div className="bg-secondary relative aspect-square">
        <Link href={`/p/${product.slug}`} className="absolute inset-0 block overflow-hidden">
          {product.images[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.images[0].alt || product.name}
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : null}
        </Link>
        {off > 0 && (
          <span className="bg-sale text-sale-foreground absolute top-2.5 left-2.5 z-10 inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-extrabold">
            -{off}%
          </span>
        )}
        <WishlistButton product={product} className="absolute top-2 right-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-2.5 md:p-3.5 md:pt-3">
        <span className="text-muted-foreground text-xs font-bold tracking-[0.02em]">
          {product.brand}
        </span>
        <Link href={`/p/${product.slug}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm leading-[1.35] font-semibold">
            {product.name}
          </h3>
        </Link>
        {variant && <p className="text-muted-foreground text-xs">{variant}</p>}
        {product.rating > 0 && (
          <RatingBadge rating={product.rating} count={product.ratingCount} />
        )}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} size="md" />
          {product.deliveryLabel && (
            <span className="text-success text-xs font-bold">
              Free delivery · {product.deliveryLabel}
            </span>
          )}
          <div className="pt-1">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </article>
  );
}
