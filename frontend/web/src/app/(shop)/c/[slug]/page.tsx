import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryNav } from '@/config/nav';
import { catalogApi } from '@/features/catalog/api/catalog-api';
import { ProductFeed } from '@/features/catalog/components/product-feed';
import { isApiError } from '@/lib/api/errors';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

function titleFor(slug: string) {
  if (slug === 'all') return 'All categories';
  return (
    categoryNav.find((item) => item.slug === slug)?.label ??
    slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** The products endpoint filters by categoryId, not slug — resolve it here so the
 *  URL can stay a readable slug. Returns undefined for "all" (no filter). */
async function resolveCategoryId(slug: string): Promise<string | undefined> {
  if (slug === 'all') return undefined;
  try {
    const category = await catalogApi.getCategory(slug, { next: { revalidate: 300 } });
    return category.id;
  } catch (error) {
    if (isApiError(error) && error.isNotFound) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: titleFor(slug) };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const categoryId = await resolveCategoryId(slug);

  return (
    <div className="container py-6 md:py-8">
      <h1 className="mb-5 text-2xl font-extrabold md:text-[32px]">{titleFor(slug)}</h1>
      <ProductFeed
        query={{ categoryId }}
        emptyTitle={`No products in ${titleFor(slug)} yet`}
      />
    </div>
  );
}
