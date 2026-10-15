'use client';

import { QuantityStepper } from '@/components/common/quantity-stepper';
import { Button } from '@/components/ui/button';
import type { Product } from '@/features/catalog/types';
import { useCartActions, useCartQuantity } from '../hooks/use-cart';

interface AddToCartButtonProps {
  product: Product;
  size?: 'sm' | 'md';
}

/**
 * Collapses to a stepper once the item is in the cart — keeps the shopper on
 * the grid instead of bouncing them to a cart page.
 */
export function AddToCartButton({ product, size = 'md' }: AddToCartButtonProps) {
  const quantity = useCartQuantity(product.id);
  const { addItem, increment, decrement } = useCartActions();
  const height = size === 'sm' ? 'h-9' : 'h-10';

  if (!product.inStock) {
    return (
      <Button variant="outline" disabled className={`${height} w-full`}>
        Out of stock
      </Button>
    );
  }

  if (quantity === 0) {
    return (
      <Button
        onClick={() => addItem(product)}
        aria-label={`Add ${product.name} to cart`}
        className={`${height} w-full text-sm font-extrabold`}
      >
        Add to cart
      </Button>
    );
  }

  return (
    <QuantityStepper
      quantity={quantity}
      max={product.maxPerOrder}
      size={size}
      onIncrement={() => increment(product.id)}
      onDecrement={() => decrement(product.id)}
    />
  );
}
