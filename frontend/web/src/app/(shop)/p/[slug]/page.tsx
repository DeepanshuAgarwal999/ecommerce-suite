import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalogApi } from '@/features/catalog/api/catalog-api';
import { isApiError } from '@/lib/api/errors';
import { ProductDetail } from '@/features/catalog/components/product-detail';
import { ProductReviews } from '@/features/catalog/components/product-reviews';
import { TrackProductView } from '@/features/analytics/components/track-product-view';
import { ProductRecommendations } from '@/features/recommendations/components/product-recommendations';

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
  return (
    <>
      <ProductDetail product={product} />
      <ProductReviews
        productId={product.id}
        ratingAverage={product.rating}
        ratingCount={product.ratingCount}
      />
      {/* Personal, so fetched in the browser - the page itself stays cached and shared. */}
      <ProductRecommendations product={product} />
      <TrackProductView productId={product.id} />
    </>
  );
}
