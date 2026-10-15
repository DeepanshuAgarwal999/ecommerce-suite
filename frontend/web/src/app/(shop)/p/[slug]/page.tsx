import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalogApi } from '@/features/catalog/api/catalog-api';
import { isApiError } from '@/lib/api/errors';
import { ProductDetail } from '@/features/catalog/components/product-detail';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function loadProduct(slug: string) {
  try {
    return await catalogApi.getProduct(slug, { next: { revalidate: 60 } });
  } catch (error) {
    if (isApiError(error) && error.isNotFound) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return {
    title: product.name,
    description: product.description,
    openGraph: { images: product.images.map((image) => image.url) },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return <ProductDetail product={product} />;
}
