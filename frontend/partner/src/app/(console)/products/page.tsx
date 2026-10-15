import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ProductTable } from '@/features/products/components/product-table';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you have listed, in every status."
        action={
          <Button asChild>
            <Link href="/products/new">
              <Plus data-icon="inline-start" aria-hidden />
              List a product
            </Link>
          </Button>
        }
      />
      <ProductTable />
    </>
  );
}
