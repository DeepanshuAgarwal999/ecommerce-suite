'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/features/products/components/product-form';
import { useCreateProduct } from '@/features/products/hooks/use-products';

export default function NewProductPage() {
  const router = useRouter();
  const create = useCreateProduct();

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => router.push('/products')}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to products
      </Button>

      <PageHeader
        title="List a product"
        description="On a vendor's behalf. Save as a draft, or submit straight for review."
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ProductForm
            isSubmitting={create.isPending}
            submitLabel={{ draft: 'Save as draft', review: 'Submit for review' }}
            onSubmit={(input, submitForReview) => create.mutate({ ...input, submitForReview })}
          />
        </CardContent>
      </Card>
    </>
  );
}
