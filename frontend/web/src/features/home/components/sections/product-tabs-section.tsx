import { ProductCard } from '@/features/catalog/components/product-card';
import type { CmsHomeSection } from '../../cms-types';
import { fetchSectionProducts } from './fetch-section-products';
import { ProductTabs, type ProductTab } from './product-tabs';
import { SectionShell } from './section-shell';

/**
 * Tabs ("String lights | Urlis | Latkans | Diyas") switching a product row.
 * Each tile is a tab: its image is the tab thumbnail, its `categoryId` picks the
 * products and its link is the "View all" target. All tabs are fetched up front
 * in parallel; a tab with no products is dropped.
 */
export async function ProductTabsSection({ section }: { section: CmsHomeSection }) {
  const results = await Promise.all(
    section.tiles.map(async (tile) => ({
      tile,
      products: await fetchSectionProducts(section.config, { categoryId: tile.categoryId, defaultLimit: 6 }),
    })),
  );

  const tabs: ProductTab[] = results
    .filter(({ products }) => products.length > 0)
    .map(({ tile, products }) => ({
      id: tile.id,
      title: tile.title,
      imageUrl: tile.imageUrl,
      linkUrl: tile.linkUrl,
      // Centred columns of up to 13rem, so a tab with 4 products sits under the
      // centred pills instead of hugging the left edge.
      panel: (
        <ul className="rail -mx-4 px-4 md:mx-0 md:grid md:grid-flow-col md:auto-cols-[minmax(0,13rem)] md:justify-center md:gap-4 md:overflow-visible md:px-0">
          {products.map((product) => (
            <li key={product.id} className="w-[170px] md:w-auto">
              <ProductCard product={product} className="h-full" />
            </li>
          ))}
        </ul>
      ),
    }));

  if (tabs.length === 0) return null;

  return (
    <SectionShell section={section}>
      <ProductTabs tabs={tabs} />
    </SectionShell>
  );
}
