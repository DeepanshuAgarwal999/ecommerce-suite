'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { QuantityStepper } from '@/components/common/quantity-stepper';
import { formatPrice } from '@/lib/utils/format';
import { useCartActions } from '../hooks/use-cart';
import type { CartLine } from '../types';

export function CartLineItem({ line }: { line: CartLine }) {
  const { increment, decrement, removeItem } = useCartActions();

  return (
    <li className="bg-card flex gap-3 rounded-xl border p-3 md:gap-4 md:p-4">
      <Link
        href={`/p/${line.slug}`}
        className="bg-secondary relative size-20 shrink-0 overflow-hidden rounded-lg md:size-24"
      >
        {line.imageUrl && (
          <Image src={line.imageUrl} alt={line.name} fill sizes="96px" className="object-cover" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">
          {line.name}
        </Link>
        {line.variantLabel && (
          <span className="text-muted-foreground text-xs">{line.variantLabel}</span>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="w-28">
            <QuantityStepper
              quantity={line.quantity}
              max={line.maxPerOrder}
              size="sm"
              onIncrement={() => increment(line.productId)}
              onDecrement={() => decrement(line.productId)}
            />
          </div>
          <div className="text-right">
            <div className="font-extrabold tabular-nums">
              {formatPrice(line.pricePaise * line.quantity)}
            </div>
            {line.mrpPaise > line.pricePaise && (
              <div className="text-muted-foreground text-xs line-through tabular-nums">
                {formatPrice(line.mrpPaise * line.quantity)}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => removeItem(line.productId)}
        aria-label={`Remove ${line.name}`}
        className="text-muted-foreground hover:text-destructive grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
      >
        <Trash2 className="size-[18px]" aria-hidden />
      </button>
    </li>
  );
}
