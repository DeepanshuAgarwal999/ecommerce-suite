'use client';

import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductForm } from '@/features/products/components/product-form';
import { useProduct, useUpdateProduct } from '@/features/products/hooks/use-products';

export default function EditProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(productId);
  const update = useUpdateProduct(productId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    );
  }

  if (!product) return <p className="text-sm text-muted-foreground">Product not found.</p>;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4"
        onClick={() => router.push(`/products/${productId}`)}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to product
      </Button>

      <PageHeader
        title={`Edit ${product.title}`}
        description="Changes to a live product go back through review unless you keep it published below."
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ProductForm
            lockVendor={{ id: product.vendorId, businessName: product.vendorName, status: 'APPROVED' }}
            defaultValues={{
              vendorId: product.vendorId,
              title: product.title,
              description: product.description ?? '',
              categoryId: product.categoryId,
              brandId: product.brandId ?? '',
              imageUrls: product.media.map((m) => m.url).join('\n'),
              isReturnable: product.isReturnable,
              isCodAvailable: product.isCodAvailable,
              variants: product.variants.map((variant) => ({
                title: variant.title,
                color: variant.options.color ?? '',
                size: variant.options.size ?? '',
                mrp: variant.mrp / 100,
                price: variant.price / 100,
                sku: variant.sku,
                weightGrams: undefined,
              })),
            }}
            isSubmitting={update.isPending}
            // ProductService.update() only ever changes status on a currently-ACTIVE
            // product (ACTIVE -> PENDING_REVIEW, unless submitForReview is explicitly
            // false). Editing a DRAFT or REJECTED product never moves its status at
            // all, so a "submit for review" button would be a no-op there — only show
            // the two-way choice when it's real.
            submitLabel={
              product.status === 'ACTIVE'
                ? { draft: 'Save & keep live', review: 'Save & send for review' }
                : 'Save changes'
            }
            onSubmit={(input, submitForReview) => {
              const { vendorId: _vendorId, ...rest } = input;
              update.mutate({ ...rest, submitForReview });
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
