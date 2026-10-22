'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, endpoints, isApiError, queryKeys } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export type ShippingMode = 'STANDARD' | 'FREE' | 'FIXED';
export type ChargeBasis = 'PER_UNIT' | 'PER_LINE';
export type RuleScope = 'CATEGORY' | 'PRODUCT';

/** All amounts are integer paise, as everywhere in the platform. */
export interface ShippingSettings {
  baseFee: number;
  freeShippingThreshold: number | null;
  codEnabled: boolean;
  codFee: number;
  updatedAt?: string;
}

export interface ShippingRule {
  id: string;
  scope: RuleScope;
  targetId: string;
  mode: ShippingMode;
  fee: number;
  chargeBasis: ChargeBasis;
  freeAbove: number | null;
  note: string | null;
  updatedAt: string;
}

export interface EffectiveRule {
  mode: ShippingMode;
  fee: number;
  chargeBasis: ChargeBasis;
  freeAbove: number | null;
  source: 'PRODUCT' | 'CATEGORY' | 'DEFAULT';
  sourceId: string | null;
  sourceName: string | null;
}

export interface ShippingOverview {
  settings: ShippingSettings;
  categories: { id: string; name: string; parentId: string | null; rule: ShippingRule | null; effective: EffectiveRule | null }[];
  products: {
    rule: ShippingRule;
    product: { id: string; title: string; slug: string; status: string; categoryName: string | null; imageUrl: string | null };
    inherited: EffectiveRule | null;
  }[];
}

export interface RuleInput {
  mode: ShippingMode;
  fee?: number;
  chargeBasis?: ChargeBasis;
  freeAbove?: number | null;
  note?: string;
}

const errorText = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

/** One-line plain-English description of a rule, used everywhere a rule is shown. */
export function describeRule(rule: Pick<EffectiveRule, 'mode' | 'fee' | 'chargeBasis' | 'freeAbove'> | null, settings?: ShippingSettings): string {
  if (!rule || rule.mode === 'STANDARD') {
    if (!settings) return 'Standard delivery';
    return settings.freeShippingThreshold === null
      ? `Standard - ${formatMoney(settings.baseFee)} per order`
      : `Standard - ${formatMoney(settings.baseFee)}, free over ${formatMoney(settings.freeShippingThreshold)}`;
  }
  if (rule.mode === 'FREE') return 'Always free delivery';
  const basis = rule.chargeBasis === 'PER_LINE' ? 'per order line' : 'per unit';
  const waiver = rule.freeAbove !== null ? `, free when the line reaches ${formatMoney(rule.freeAbove)}` : '';
  return `${formatMoney(rule.fee)} ${basis}${waiver}`;
}

export function useShippingOverview() {
  return useQuery({ queryKey: queryKeys.shipping.overview(), queryFn: () => api.get<ShippingOverview>(endpoints.admin.shipping) });
}

export function useProductDelivery(productId: string) {
  return useQuery({
    queryKey: queryKeys.shipping.product(productId),
    queryFn: () => api.get<{ settings: ShippingSettings; rule: EffectiveRule | null }>(endpoints.admin.productDelivery(productId)),
    enabled: Boolean(productId),
  });
}

export function useUpdateShippingSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ShippingSettings>) => api.patch<ShippingSettings>(endpoints.admin.shippingSettings, input),
    onSuccess: () => {
      toast.success('Delivery settings saved - they apply to the next cart and checkout');
      void client.invalidateQueries({ queryKey: queryKeys.shipping.all });
    },
    onError: (error) => toast.error(errorText(error, 'Could not save the settings.')),
  });
}

export function useUpsertRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, targetId, input }: { scope: RuleScope; targetId: string; input: RuleInput }) =>
      api.put<ShippingRule>(endpoints.admin.shippingRule(scope, targetId), input),
    onSuccess: () => {
      toast.success('Delivery rule saved');
      void client.invalidateQueries({ queryKey: queryKeys.shipping.all });
    },
    onError: (error) => toast.error(errorText(error, 'Could not save the rule.')),
  });
}

export function useDeleteRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, targetId }: { scope: RuleScope; targetId: string }) => api.delete(endpoints.admin.shippingRule(scope, targetId)),
    onSuccess: () => {
      toast.success('Rule removed - it now inherits again');
      void client.invalidateQueries({ queryKey: queryKeys.shipping.all });
    },
    onError: (error) => toast.error(errorText(error, 'Could not remove the rule.')),
  });
}

/** ₹ text field <-> paise. Empty string means "not set". */
export const toPaise = (rupees: string): number | null => (rupees.trim() === '' ? null : Math.round(Number(rupees) * 100));
export const toRupees = (paise: number | null | undefined): string => (paise === null || paise === undefined ? '' : String(paise / 100));
