'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductForm } from '@/features/products/components/product-form';
import { useUpdateProduct, useVendorProducts } from '@/features/products/hooks/use-products';
import { isApiError } from '@/lib/api';
import { PackageSearch } from 'lucide-react';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  // Same query as the list page, so arriving from /products hits a warm cache.
  // There is no GET /vendor/products/:id yet — this is the pragmatic substitute.
  const products = useVendorProducts({ page: 1, limit: 50 });
  const update = useUpdateProduct(params.id);

  if (products.isPending) {
    return <Skeleton className="h-96 w-full max-w-2xl" />;
  }

  const product = products.data?.items.find((item) => item.id === params.id);

  if (!product) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Open this product from your list"
        description="Direct links aren't supported yet — go back to Products and click the item you want to edit."
        action={
          <Button asChild>
            <Link href="/products">Back to products</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader title={product.title} description="Changes to variants go back through review if the product is live." />
      <div className="bg-card max-w-2xl rounded-2xl border p-6">
        <ProductForm
          isSubmitting={update.isPending}
          submitLabel={{ draft: 'Save changes', review: 'Save & submit for review' }}
          defaultValues={{
            title: product.title,
            categoryId: product.categoryId,
            brandId: product.brandId ?? '',
            variants: product.variants.map((variant) => ({
              title: variant.title,
              color: '',
              size: '',
              mrp: variant.mrp / 100,
              price: variant.price / 100,
              sku: variant.sku,
              weightGrams: undefined,
            })),
          }}
          onSubmit={(input, submitForReview) => {
            update.mutate(
              { ...input, submitForReview },
              {
                onSuccess: () => {
                  toast.success('Product updated');
                  router.push('/products');
                },
                onError: (error) => {
                  toast.error(
                    isApiError(error) ? error.message : 'Could not save your changes. Try again.',
                  );
                },
              },
            );
          }}
        />
      </div>
    </>
  );
}
