import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';

/** Admin-managed delivery settings (catalog-service ShippingService). Paise throughout. */
export interface ShippingSettings {
  baseFee: number;
  /** Null = no free-delivery threshold. */
  freeShippingThreshold: number | null;
  codEnabled: boolean;
  codFee: number;
}

export interface DeliveryRule {
  mode: 'STANDARD' | 'FREE' | 'FIXED';
  fee: number;
  chargeBasis: 'PER_UNIT' | 'PER_LINE';
  freeAbove: number | null;
}

export interface DeliveryEstimate {
  shippingTotal: number;
  baseFee: number;
  itemCharges: { productId: string; fee: number }[];
  freeShippingRemaining: number | null;
  settings: ShippingSettings;
}

export const shippingKeys = {
  settings: ['shipping', 'settings'] as const,
  product: (productId: string) => ['shipping', 'product', productId] as const,
  estimate: (lines: unknown) => ['shipping', 'estimate', lines] as const,
};

export function useShippingSettings() {
  return useQuery({
    queryKey: shippingKeys.settings,
    queryFn: () => api.get<ShippingSettings>('/catalog/shipping'),
    staleTime: 5 * 60_000,
  });
}

export function useProductDelivery(productId: string | undefined) {
  return useQuery({
    queryKey: shippingKeys.product(productId ?? ''),
    queryFn: () => api.get<{ settings: ShippingSettings; rule: DeliveryRule | null }>(`/catalog/products/${productId}/delivery`),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Delivery for the current basket from the server - the same calculator the
 * order total uses, so the cart never promises a charge checkout won't honour.
 */
export function useDeliveryEstimate(lines: { productId: string; quantity: number; lineTotal: number }[]) {
  return useQuery({
    queryKey: shippingKeys.estimate(lines),
    queryFn: () => api.post<DeliveryEstimate>('/catalog/shipping/estimate', { lines }),
    enabled: lines.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/** Store-level promise for banners and USP chips: "Free over ₹999" / "₹49 per order". */
export function storeDeliveryCopy(settings: ShippingSettings | undefined): { title: string; detail: string } {
  if (!settings) return { title: 'Fast delivery', detail: 'Across India' };
  if (settings.freeShippingThreshold === null) {
    return settings.baseFee === 0
      ? { title: 'Free delivery', detail: 'On every order' }
      : { title: 'Delivery', detail: `${formatPrice(settings.baseFee)} per order` };
  }
  return settings.freeShippingThreshold === 0
    ? { title: 'Free delivery', detail: 'On every order' }
    : { title: 'Free delivery', detail: `Over ${formatPrice(settings.freeShippingThreshold)}` };
}

/** The delivery line on a product page, for this product's own rule. */
export function productDeliveryCopy(settings: ShippingSettings | undefined, rule: DeliveryRule | null | undefined): string {
  if (rule?.mode === 'FREE') return 'Free delivery on this item';
  if (rule?.mode === 'FIXED') {
    const base = `${formatPrice(rule.fee)} delivery${rule.chargeBasis === 'PER_UNIT' ? ' per item' : ''}`;
    return rule.freeAbove !== null ? `${base}, free over ${formatPrice(rule.freeAbove)}` : base;
  }
  const copy = storeDeliveryCopy(settings);
  return copy.title === 'Free delivery' ? `${copy.title} ${copy.detail.toLowerCase()}` : `${formatPrice(settings?.baseFee ?? 0)} delivery per order`;
}
