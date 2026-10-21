'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Boxes, Package, Pencil, Store, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SetStockDialog } from '@/features/inventory/components/set-stock-dialog';
import { ReviewProductDialog } from '@/features/products/components/review-product-dialog';
import { useArchiveProduct, useProduct } from '@/features/products/hooks/use-products';
import { ProductInsightsPanel } from '@/features/products/insights/product-insights-panel';
import type { ProductSource, ProductVariant } from '@/features/products/types';
import { formatDate, formatMoney } from '@/lib/format';

const SOURCE_LABEL: Record<ProductSource, string> = {
  VENDOR_WEB: 'Self-listed by vendor',
  ADMIN_WEB: 'Listed by staff',
  ANDROID: 'Vendor app (Android)',
  IOS: 'Vendor app (iOS)',
  API: 'API / import',
};

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const [decision, setDecision] = useState<'ACTIVE' | 'REJECTED' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [stockVariant, setStockVariant] = useState<ProductVariant | null>(null);
  const archive = useArchiveProduct();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!product) return <p className="text-sm text-muted-foreground">Product not found.</p>;

  const canReview = product.status === 'PENDING_REVIEW';
  const canArchive = product.status !== 'ARCHIVED';

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => router.push('/products')}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to products
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{product.title}</h2>
            <StatusBadge status={product.status} />
          </div>
          <Link
            href={`/vendors`}
            className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Store className="size-3.5" aria-hidden />
            {product.vendorName}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReview && (
            <>
              <Button variant="destructive" onClick={() => setDecision('REJECTED')}>
                Reject
              </Button>
              <Button onClick={() => setDecision('ACTIVE')}>Publish</Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push(`/products/${productId}/edit`)}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
          {canArchive && (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              <Trash2 className="size-4" aria-hidden />
              Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {product.media.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.media.map((image) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.altText ?? ''}
                    className="size-20 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

            {product.highlights.length > 0 && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {product.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}

            {product.status === 'REJECTED' && product.rejectionReason && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <span className="font-medium">Rejection reason: </span>
                {product.rejectionReason}
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Category" value={product.category.name} />
              <Field label="Brand" value={product.brand?.name ?? '—'} />
              <Field label="Tax rate" value={`${(product.taxBps / 100).toFixed(1)}%`} />
              <Field label="Returnable" value={product.isReturnable ? `${product.returnWindowDays} days` : 'No'} />
              <Field label="Cash on delivery" value={product.isCodAvailable ? 'Available' : 'Not available'} />
              <Field label="Units sold" value={product.soldCount.toLocaleString()} />
              <Field label="Listed by" value={SOURCE_LABEL[product.source] ?? product.source} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" aria-hidden />
              Variants ({product.variants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {product.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{variant.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{variant.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">{formatMoney(variant.price)}</p>
                    {variant.mrp !== variant.price && (
                      <p className="text-xs text-muted-foreground line-through tabular-nums">
                        {formatMoney(variant.mrp)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={`Set stock for ${variant.title}`}
                    onClick={() => setStockVariant(variant)}
                  >
                    <Boxes className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Created {formatDate(product.createdAt)}
        {product.publishedAt && ` · Published ${formatDate(product.publishedAt)}`}
      </p>

      <div className="mt-8">
        <ProductInsightsPanel productId={product.id} />
      </div>

      <ReviewProductDialog product={product} decision={decision} onClose={() => setDecision(null)} />

      {stockVariant && (
        <SetStockDialog
          vendorId={product.vendorId}
          productId={product.id}
          variantId={stockVariant.id}
          sku={stockVariant.sku}
          variantLabel={`${product.title} — ${stockVariant.title}`}
          onClose={() => setStockVariant(null)}
        />
      )}

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this product?</DialogTitle>
            <DialogDescription>
              {product.title} will be taken off the storefront immediately. This does
              not delete its order history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={archive.isPending}
              onClick={() => archive.mutate(product.id, { onSuccess: () => setConfirmArchive(false) })}
            >
              {archive.isPending ? 'Archiving…' : 'Archive product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
