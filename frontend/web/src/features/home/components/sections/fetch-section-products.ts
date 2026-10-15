import { catalogApi } from '@/features/catalog/api/catalog-api';
import type { Product } from '@/features/catalog/types';
import type { CmsSectionConfig } from '../../cms-types';

/**
 * Products for a CMS section, from its config (category / sort / limit). An
 * empty list on any failure - callers render nothing rather than a broken shelf.
 */
export async function fetchSectionProducts(
  config: CmsSectionConfig | null,
  overrides: { categoryId?: string | null; defaultLimit?: number } = {},
): Promise<Product[]> {
  try {
    const page = await catalogApi.listProducts(
      {
        categoryId: overrides.categoryId ?? config?.categoryId,
        sort: config?.sort ?? 'popular',
        pageSize: config?.limit ?? overrides.defaultLimit ?? 8,
      },
      { next: { revalidate: 300 } },
    );
    return page.items;
  } catch {
    return [];
  }
}
