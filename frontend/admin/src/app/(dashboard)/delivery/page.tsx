'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CornerDownRight, Gift, Package, Plus, Search, Truck } from 'lucide-react';
import { cn } from 'cn';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { productsApi } from '@/features/products/api/products-api';
import {
  describeRule,
  toPaise,
  toRupees,
  useDeleteRule,
  useShippingOverview,
  useUpdateShippingSettings,
  useUpsertRule,
  type EffectiveRule,
  type ShippingMode,
  type ShippingOverview,
  type ShippingRule,
  type ShippingSettings,
} from '@/features/shipping/api';
import { RuleEditorDialog } from '@/features/shipping/components/rule-editor-dialog';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatMoney } from '@/lib/format';

const MODE_ICON: Record<ShippingMode, typeof Truck> = { STANDARD: Truck, FREE: Gift, FIXED: Package };

interface Editing {
  scope: 'CATEGORY' | 'PRODUCT';
  targetId: string;
  title: string;
  current: ShippingRule | null;
  inherited: EffectiveRule | null;
}

/**
 * Delivery charges, fully admin-controlled. Precedence: product rule, then the
 * nearest category rule up the tree, then the store settings. Every cart, quote
 * and order prices through these on the next request - nothing to deploy.
 */
export default function DeliveryPage() {
  const { data, isLoading } = useShippingOverview();
  const upsert = useUpsertRule();
  const remove = useDeleteRule();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [picking, setPicking] = useState(false);

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="Delivery charges" />
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Delivery charges"
        description="Set the store delivery fee, then override it for whole categories or individual products. Product beats category, and categories pass their rule down to sub-categories."
      />

      <div className="space-y-6">
        <SettingsCard key={JSON.stringify(data.settings)} settings={data.settings} />

        <CategoryRules
          overview={data}
          onEdit={(category) =>
            setEditing({
              scope: 'CATEGORY',
              targetId: category.id,
              title: category.name,
              current: category.rule,
              // What it gets without its own rule = the parent's effective rule.
              inherited: category.parentId ? (data.categories.find((entry) => entry.id === category.parentId)?.effective ?? null) : null,
            })
          }
        />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Product overrides</CardTitle>
              <CardDescription>For individual products that differ from their category - a sofa that needs two-person delivery, a free-shipping launch.</CardDescription>
            </div>
            <Button onClick={() => setPicking(true)}>
              <Plus className="size-4" aria-hidden /> Add override
            </Button>
          </CardHeader>
          <CardContent>
            {data.products.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">No product overrides - every product follows its category.</p>
            ) : (
              <ul className="divide-y">
                {data.products.map(({ rule, product, inherited }) => {
                  const Icon = MODE_ICON[rule.mode];
                  return (
                    <li key={rule.id} className="flex items-center gap-3 py-3">
                      <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="size-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${product.id}`} className="block truncate font-medium hover:underline">
                          {product.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {product.categoryName} · instead of {describeRule(inherited, data.settings).toLowerCase()}
                        </p>
                      </div>
                      <span className="hidden items-center gap-1.5 text-sm sm:inline-flex">
                        <Icon className="size-4 text-primary" aria-hidden />
                        {describeRule(rule, data.settings)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing({ scope: 'PRODUCT', targetId: product.id, title: product.title, current: rule, inherited })}
                      >
                        Edit
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <RuleEditorDialog
          key={`${editing.scope}:${editing.targetId}`}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing.title}
          inherited={editing.inherited}
          settings={data.settings}
          current={editing.current}
          saving={upsert.isPending || remove.isPending}
          onSave={(input) => upsert.mutate({ scope: editing.scope, targetId: editing.targetId, input }, { onSuccess: () => setEditing(null) })}
          onRemove={() => remove.mutate({ scope: editing.scope, targetId: editing.targetId }, { onSuccess: () => setEditing(null) })}
        />
      ) : null}

      <ProductPicker
        open={picking}
        onOpenChange={setPicking}
        exclude={new Set(data.products.map((entry) => entry.product.id))}
        onPick={(product) => {
          setPicking(false);
          const category = data.categories.find((entry) => entry.id === product.categoryId);
          setEditing({ scope: 'PRODUCT', targetId: product.id, title: product.title, current: null, inherited: category?.effective ?? null });
        }}
      />
    </>
  );
}

function SettingsCard({ settings }: { settings: ShippingSettings }) {
  const save = useUpdateShippingSettings();
  const [baseFee, setBaseFee] = useState(toRupees(settings.baseFee));
  const [freeEnabled, setFreeEnabled] = useState(settings.freeShippingThreshold !== null);
  const [threshold, setThreshold] = useState(toRupees(settings.freeShippingThreshold ?? 99_900));
  const [codEnabled, setCodEnabled] = useState(settings.codEnabled);
  const [codFee, setCodFee] = useState(toRupees(settings.codFee));

  const next: ShippingSettings = {
    baseFee: toPaise(baseFee) ?? 0,
    freeShippingThreshold: freeEnabled ? (toPaise(threshold) ?? 0) : null,
    codEnabled,
    codFee: toPaise(codFee) ?? 0,
  };
  const invalid = [next.baseFee, next.codFee, next.freeShippingThreshold ?? 0].some((value) => Number.isNaN(value) || value < 0);
  const dirty =
    next.baseFee !== settings.baseFee ||
    next.freeShippingThreshold !== settings.freeShippingThreshold ||
    next.codEnabled !== settings.codEnabled ||
    next.codFee !== settings.codFee;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store delivery settings</CardTitle>
        <CardDescription>Applies to every product on &ldquo;Standard&rdquo; delivery - the default for anything without its own rule.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="base-fee">Delivery fee per order (₹)</Label>
            <Input id="base-fee" inputMode="decimal" value={baseFee} onChange={(event) => setBaseFee(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="threshold" className="flex items-center justify-between">
              Free delivery above (₹)
              <Switch checked={freeEnabled} onCheckedChange={setFreeEnabled} aria-label="Offer free delivery above a basket value" />
            </Label>
            <Input id="threshold" inputMode="decimal" value={threshold} disabled={!freeEnabled} onChange={(event) => setThreshold(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cod-fee" className="flex items-center justify-between">
              Cash on delivery fee (₹)
              <Switch checked={codEnabled} onCheckedChange={setCodEnabled} aria-label="Offer cash on delivery" />
            </Label>
            <Input id="cod-fee" inputMode="decimal" value={codFee} disabled={!codEnabled} onChange={(event) => setCodFee(event.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
          <p>
            Shoppers see:{' '}
            <span className="font-semibold">
              {invalid
                ? 'enter valid amounts'
                : next.freeShippingThreshold === null
                  ? `${formatMoney(next.baseFee)} delivery on every order`
                  : `${formatMoney(next.baseFee)} delivery, free on orders over ${formatMoney(next.freeShippingThreshold)}`}
              {!invalid ? (codEnabled ? ` · COD ${next.codFee ? `+${formatMoney(next.codFee)}` : 'free'}` : ' · COD off') : ''}
            </span>
          </p>
          <Button onClick={() => save.mutate(next)} disabled={!dirty || invalid || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryRules({ overview, onEdit }: { overview: ShippingOverview; onEdit: (category: ShippingOverview['categories'][number]) => void }) {
  // Flatten the tree depth-first so sub-categories sit indented under their parent.
  const rows = useMemo(() => {
    const children = new Map<string | null, ShippingOverview['categories']>();
    for (const category of overview.categories) {
      const key = category.parentId && overview.categories.some((entry) => entry.id === category.parentId) ? category.parentId : null;
      children.set(key, [...(children.get(key) ?? []), category]);
    }
    const out: { category: ShippingOverview['categories'][number]; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const category of children.get(parent) ?? []) {
        out.push({ category, depth });
        if (depth < 8) walk(category.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [overview.categories]);

  const withRules = overview.categories.filter((category) => category.rule).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category rules</CardTitle>
        <CardDescription>
          {withRules === 0 ? 'No category rules yet - every category uses the store settings.' : `${withRules} ${withRules === 1 ? 'category has' : 'categories have'} their own rule; sub-categories inherit it.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map(({ category, depth }) => {
            const own = category.rule;
            const effective = category.effective;
            const Icon = MODE_ICON[effective?.mode ?? 'STANDARD'];
            return (
              <li key={category.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
                  {depth > 0 ? <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  <span className={cn('truncate', own ? 'font-semibold' : 'text-muted-foreground')}>{category.name}</span>
                </div>
                <span className="hidden min-w-0 items-center gap-1.5 text-sm md:inline-flex">
                  <Icon className={cn('size-4', own ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                  <span className={cn('truncate', !own && 'text-muted-foreground')}>{describeRule(effective, overview.settings)}</span>
                </span>
                <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                  {own ? 'Own rule' : effective?.source === 'CATEGORY' ? `From ${effective.sourceName}` : 'Store default'}
                </span>
                <Button variant={own ? 'outline' : 'ghost'} size="sm" onClick={() => onEdit(category)}>
                  {own ? 'Edit' : 'Set rule'}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProductPicker({
  open,
  onOpenChange,
  exclude,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exclude: Set<string>;
  onPick: (product: { id: string; title: string; categoryId: string }) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const { data, isFetching } = useQuery({
    queryKey: ['shipping', 'product-picker', q],
    queryFn: () => productsApi.list({ q: q || undefined, limit: 12, status: 'ALL' }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a product</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by name…" className="pl-9" />
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {(data?.items ?? []).map((product) => {
            const taken = exclude.has(product.id);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => onPick({ id: product.id, title: product.title, categoryId: product.categoryId })}
                  className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{product.title}</span>
                    <span className="text-xs text-muted-foreground">{product.vendorName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{taken ? 'Has override' : formatMoney(product.minPrice)}</span>
                </button>
              </li>
            );
          })}
          {!isFetching && data?.items.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">No products match.</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
