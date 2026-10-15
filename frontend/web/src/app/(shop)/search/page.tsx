import type { Metadata } from 'next';
import { ProductFeed } from '@/features/catalog/components/product-feed';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q}` : 'Search' };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = '' } = await searchParams;
  const term = q.trim();

  return (
    <div className="container py-6 md:py-8">
      <h1 className="mb-5 text-2xl font-extrabold md:text-[32px]">
        {term ? (
          <>
            Results for <span className="text-primary">“{term}”</span>
          </>
        ) : (
          'Search'
        )}
      </h1>
      {term ? (
        <ProductFeed query={{ search: term }} emptyTitle={`No matches for “${term}”`} />
      ) : (
        <p className="text-muted-foreground">Type in the search box above to find products.</p>
      )}
    </div>
  );
}
