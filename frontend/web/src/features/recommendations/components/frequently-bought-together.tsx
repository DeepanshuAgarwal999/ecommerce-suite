'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCartActions } from '@/features/cart/hooks/use-cart';
import type { Product } from '@/features/catalog/types';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';
import type { RecSource } from '../api/recs-api';
import { useImpressions } from '../hooks/use-impressions';

const MAX_ADDONS = 2;

/**
 * Amazon-style bundle: this product + its top complements, each with a checkbox,
 * a running total and one "Add N to cart" button. The add-ons are what shoppers
 * actually bought with this item ("Frequently bought together"); for a product
 * with no history yet they come from complementary categories, and the heading
 * says so honestly ("Goes well with").
 */
export function FrequentlyBoughtTogether({
  product,
  addons,
  source,
}: {
  product: Product;
  addons: Product[];
  source: RecSource;
}) {
  const items = useMemo(() => [product, ...addons.filter((item) => item.inStock).slice(0, MAX_ADDONS)], [product, addons]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((item) => item.id)));
  const { addItem } = useCartActions();
  const ref = useImpressions<HTMLElement>(items.slice(1).map((item) => item.id));

  if (items.length < 2) return null;

  const chosen = items.filter((item) => selected.has(item.id));
  const total = chosen.reduce((sum, item) => sum + item.pricePaise, 0);
  const mrpTotal = chosen.reduce((sum, item) => sum + item.mrpPaise, 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    chosen.forEach((item) => addItem(item, 1));
    toast.success(chosen.length === 1 ? 'Added to cart' : `${chosen.length} items added to cart`);
  }

  return (
    <section ref={ref} aria-label="Frequently bought together" className="pt-8 md:pt-12">
      <h2 className="mb-1 text-base font-semibold sm:text-lg">
        {source === 'learned' ? 'Frequently bought together' : 'Goes well with'}
      </h2>
      <p className="text-muted-foreground mb-4 text-xs">
        {source === 'learned' ? 'Shoppers who bought this also picked these up' : 'Hand-in-hand picks for this item'}
      </p>

      <div className="bg-card flex flex-col gap-5 rounded-2xl border p-4 md:flex-row md:items-center md:p-5">
        <ol className="flex items-center gap-2 overflow-x-auto md:gap-3">
          {items.map((item, index) => {
            const isSelected = selected.has(item.id);
            return (
              <li key={item.id} className="flex shrink-0 items-center gap-2 md:gap-3">
                {index > 0 && <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden />}
                <div className={cn('relative w-[104px] transition-opacity md:w-[132px]', !isSelected && 'opacity-45')}>
                  <Link
                    href={`/p/${item.slug}`}
                    className="bg-secondary relative block aspect-square overflow-hidden rounded-xl border"
                  >
                    {item.images[0] && (
                      <Image src={item.images[0].url} alt={item.images[0].alt} fill sizes="132px" className="object-cover" />
                    )}
                  </Link>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`${isSelected ? 'Remove' : 'Add'} ${item.name} ${isSelected ? 'from' : 'to'} the bundle`}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      'absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-md border-2 transition-colors',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-input',
                    )}
                  >
                    {isSelected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                  </button>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-tight">
                    {index === 0 && <span className="font-semibold">This item: </span>}
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-sm font-bold">{formatPrice(item.pricePaise)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-2 border-t pt-4 md:ml-auto md:min-w-[220px] md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <p className="text-muted-foreground text-sm">
            Total for {chosen.length} {chosen.length === 1 ? 'item' : 'items'}
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold">{formatPrice(total)}</span>
            {mrpTotal > total && (
              <span className="text-muted-foreground text-sm line-through">{formatPrice(mrpTotal)}</span>
            )}
          </p>
          <Button type="button" disabled={chosen.length === 0} onClick={addSelected} className="w-full">
            {chosen.length <= 1 ? 'Add to cart' : `Add all ${chosen.length} to cart`}
          </Button>
        </div>
      </div>
    </section>
  );
}
