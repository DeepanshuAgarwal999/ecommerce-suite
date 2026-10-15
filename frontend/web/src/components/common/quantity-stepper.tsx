'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  quantity: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The compact minus/count/plus control that replaces the Add button once an
 * item is in the cart. Kept dense so it fits inside a product tile.
 */
export function QuantityStepper({
  quantity,
  max,
  onIncrement,
  onDecrement,
  size = 'md',
  className,
}: QuantityStepperProps) {
  const atMax = quantity >= max;

  return (
    <div
      className={cn(
        'bg-primary text-primary-foreground flex items-center justify-between rounded-md font-semibold',
        size === 'sm' ? 'h-8 w-full text-sm' : 'h-9 w-full text-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={onDecrement}
        aria-label={quantity <= 1 ? 'Remove from cart' : 'Decrease quantity'}
        className="grid h-full w-9 place-items-center rounded-l-md transition-colors hover:bg-black/10 active:bg-black/20"
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <span aria-live="polite" className="tabular-nums">
        {quantity}
      </span>

      <button
        type="button"
        onClick={onIncrement}
        disabled={atMax}
        aria-label={atMax ? `Limit of ${max} reached` : 'Increase quantity'}
        className="grid h-full w-9 place-items-center rounded-r-md transition-colors hover:bg-black/10 active:bg-black/20 disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
