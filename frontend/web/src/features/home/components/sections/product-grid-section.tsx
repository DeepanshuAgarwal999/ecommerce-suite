import { ProductCard } from '@/features/catalog/components/product-card';
import type { CmsHomeSection } from '../../cms-types';
import { fetchSectionProducts } from './fetch-section-products';
import { SectionShell } from './section-shell';

/** A grid of real products from a category / sort ("Diwali hosting needs").
 *  Needs no tiles - the config is the query. */
export async function ProductGridSection({ section }: { section: CmsHomeSection }) {
  const products = await fetchSectionProducts(section.config, { defaultLimit: 8 });
  if (products.length === 0) return null;

  return (
    <SectionShell
      section={section}
      viewAll={section.config?.viewAllUrl ? { href: section.config.viewAllUrl, label: 'View all' } : undefined}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} className="h-full text-foreground" />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
