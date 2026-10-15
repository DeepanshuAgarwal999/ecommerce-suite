'use client';

import Link from 'next/link';
import { MoreHorizontal, Package, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useArchiveProduct, useVendorProducts } from '../hooks/use-products';
import { formatPrice } from '@/lib/utils/format';
import type { ProductStatus } from '../types';

function priceRange(variants: { price: number }[]): string {
  if (variants.length === 0) return '—';
  const prices = variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}

export function ProductTable({ status }: { status?: ProductStatus }) {
  const products = useVendorProducts({ page: 1, limit: 50, status });
  const archive = useArchiveProduct();

  if (products.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const items = products.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No products yet"
        description="List your first product to start selling."
        action={
          <Button asChild>
            <Link href="/products/new">List a product</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="scrollbar-none overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Variants</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">
                <Link href={`/products/${product.id}`} className="hover:underline">
                  {product.title}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={product.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{product.variants.length}</TableCell>
              <TableCell className="tabular-nums">{priceRange(product.variants)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Product actions">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/products/${product.id}`}>
                        <Pencil aria-hidden />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => archive.mutate(product.id)}
                    >
                      <Trash2 aria-hidden />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
