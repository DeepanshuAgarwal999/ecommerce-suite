import { memo, useCallback, useRef } from 'react';
import { View } from 'react-native';
import { SectionHeader } from '@/components/common/section-header';
import { ProductRail } from '@/features/catalog/components/product-rail';
import { trackRecommendation } from '@/features/analytics/track';
import { useForYou } from '../api';

/**
 * Impressions feed the recommender's fatigue model, so a product shown and
 * ignored repeatedly ranks lower. Batched and de-duplicated per session.
 */
export function useImpressions() {
  const seen = useRef(new Set<string>());
  return useCallback((productIds: string[]) => {
    const fresh = productIds.filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    trackRecommendation('impression', { productIds: fresh });
  }, []);
}

/** Returning shoppers: recently viewed + picked for you. Renders nothing for a first visit. */
export const ForYou = memo(function ForYou() {
  const { data } = useForYou();
  const onImpressions = useImpressions();
  if (!data) return null;

  const hasRecent = data.recentlyViewed.items.length > 0;
  const hasRecommended = data.recommended.items.length > 0;
  if (!hasRecent && !hasRecommended) return null;

  return (
    <View style={{ gap: 28 }}>
      {hasRecent ? (
        <View>
          <SectionHeader title="Recently viewed" subtitle="Pick up where you left off" />
          <ProductRail products={data.recentlyViewed.items} />
        </View>
      ) : null}
      {hasRecommended ? (
        <View>
          <SectionHeader title="Picked for you" subtitle="Based on what you've been browsing" />
          <ProductRail products={data.recommended.items} onViewableChange={onImpressions} />
        </View>
      ) : null}
    </View>
  );
});
