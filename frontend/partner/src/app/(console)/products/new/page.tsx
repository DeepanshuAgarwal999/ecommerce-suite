'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { ProductForm } from '@/features/products/components/product-form';
import { useCreateProduct } from '@/features/products/hooks/use-products';
import { isApiError } from '@/lib/api';

export default function NewProductPage() {
  const router = useRouter();
  const create = useCreateProduct();

  return (
    <>
      <PageHeader
        title="List a product"
        description="Save as a draft any time, or submit straight for review."
      />
      <div className="bg-card max-w-2xl rounded-2xl border p-6">
        <ProductForm
          isSubmitting={create.isPending}
          submitLabel={{ draft: 'Save as draft', review: 'Submit for review' }}
          onSubmit={(input, submitForReview) => {
            create.mutate(input, {
              onSuccess: () => {
                toast.success(submitForReview ? 'Submitted for review' : 'Saved as draft');
                router.push('/products');
              },
              onError: (error) => {
                toast.error(
                  isApiError(error) ? error.message : 'Could not save the product. Try again.',
                );
              },
            });
          }}
        />
      </div>
    </>
  );
}
