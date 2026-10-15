import { ProductCard } from '@/features/catalog/components/product-card';
import type { CmsHomeSection } from '../../cms-types';
import { DealCountdown } from './deal-countdown';
import { fetchSectionProducts } from './fetch-section-products';
import { SectionShell } from './section-shell';

/** Product rail under a live countdown, on a tinted band by default. */
export async function DealOfDaySection({ section }: { section: CmsHomeSection }) {
  const products = await fetchSectionProducts(section.config, { defaultLimit: 10 });
  if (products.length === 0) return null;

  return (
    <SectionShell
      section={section}
      defaultTone="wash"
      aside={<DealCountdown endsAt={section.config?.countdownEndsAt} />}
    >
      <ul className="rail -mx-4 px-4 md:mx-0 md:px-0">
        {products.map((product) => (
          <li key={product.id} className="w-[180px] md:w-[224px]">
            <ProductCard product={product} className="h-full" />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
