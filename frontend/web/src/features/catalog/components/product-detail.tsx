import Image from 'next/image';
import { RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Price } from '@/components/common/price';
import { RatingBadge } from '@/components/common/rating-badge';
import { Separator } from '@/components/ui/separator';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { BuyNowButton } from '@/features/checkout/components/buy-now-button';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';
import { formatPackSize } from '@/lib/utils/format';
import type { Product } from '../types';

export function ProductDetail({ product }: { product: Product }) {
  const [hero, ...thumbs] = product.images;
  const variant =
    product.variantLabel ??
    (product.packSize
      ? formatPackSize(product.packSize.value, product.packSize.unit)
      : undefined);

  return (
    <article className="container grid gap-8 py-6 md:grid-cols-[1.1fr_1fr] md:gap-12 md:py-10">
      <div className="flex flex-col gap-3">
        <div className="bg-secondary relative aspect-square overflow-hidden rounded-2xl">
          {hero && (
            <Image
              src={hero.url}
              alt={hero.alt || product.name}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          )}
        </div>
        {thumbs.length > 0 && (
          <ul className="rail">
            {thumbs.map((image) => (
              <li key={image.url} className="bg-secondary relative size-20 overflow-hidden rounded-lg">
                <Image src={image.url} alt={image.alt} fill sizes="80px" className="object-cover" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-sm font-bold tracking-[0.02em]">
            {product.brand}
          </span>
          <h1 className="text-2xl leading-tight font-extrabold md:text-[32px]">
            {product.name}
          </h1>
          {variant && <p className="text-muted-foreground text-sm">{variant}</p>}
          {product.rating > 0 && (
            <RatingBadge rating={product.rating} count={product.ratingCount} />
          )}
        </div>

        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} size="lg" />
        <p className="text-muted-foreground -mt-2 text-xs">Inclusive of all taxes</p>

        <div className="flex max-w-sm flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <AddToCartButton product={product} />
            </div>
            <WishlistButton product={product} className="shrink-0" />
          </div>
          <BuyNowButton product={product} />
        </div>

        <Separator />

        <ul className="grid gap-3 text-sm">
          <li className="flex items-center gap-3">
            <Truck className="text-primary size-5" strokeWidth={1.9} aria-hidden />
            <span>
              {product.deliveryLabel
                ? `Free delivery by ${product.deliveryLabel}`
                : 'Free delivery on orders over ₹999'}
            </span>
          </li>
          <li className="flex items-center gap-3">
            <RotateCcw className="text-primary size-5" strokeWidth={1.9} aria-hidden />
            <span>7-day easy returns</span>
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="text-primary size-5" strokeWidth={1.9} aria-hidden />
            <span>Secure payments: UPI, cards, cash on delivery</span>
          </li>
        </ul>

        <Separator />

        <section>
          <h2 className="mb-2 text-base font-extrabold">About this product</h2>
          <p className="text-foreground/85 text-sm leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </section>
      </div>
    </article>
  );
}
