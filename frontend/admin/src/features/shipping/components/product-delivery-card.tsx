'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { describeRule, useDeleteRule, useShippingOverview, useUpsertRule } from '../api';
import { RuleEditorDialog } from './rule-editor-dialog';

/** Delivery terms for one product, editable in place on the product page. */
export function ProductDeliveryCard({ productId, productTitle, categoryId }: { productId: string; productTitle: string; categoryId: string }) {
  const { data, isLoading } = useShippingOverview();
  const upsert = useUpsertRule();
  const remove = useDeleteRule();
  const [open, setOpen] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-28 rounded-xl" />;

  const own = data.products.find((entry) => entry.product.id === productId)?.rule ?? null;
  const inherited = data.categories.find((category) => category.id === categoryId)?.effective ?? null;
  const effective = own ?? inherited;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-4" aria-hidden /> Delivery
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {own ? 'Edit override' : 'Override'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{describeRule(effective, data.settings)}</p>
        <p className="text-xs text-muted-foreground">
          {own
            ? 'Product override'
            : inherited?.source === 'CATEGORY'
              ? `From the ${inherited.sourceName} category rule`
              : 'Store default'}{' '}
          · <Link href="/delivery" className="hover:underline">All delivery rules</Link>
        </p>
      </CardContent>
      {open ? (
        <RuleEditorDialog
          open
          onOpenChange={setOpen}
          title={productTitle}
          inherited={inherited}
          settings={data.settings}
          current={own}
          saving={upsert.isPending || remove.isPending}
          onSave={(input) => upsert.mutate({ scope: 'PRODUCT', targetId: productId, input }, { onSuccess: () => setOpen(false) })}
          onRemove={() => remove.mutate({ scope: 'PRODUCT', targetId: productId }, { onSuccess: () => setOpen(false) })}
        />
      ) : null}
    </Card>
  );
}
