'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes, Package, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVendor } from '@/features/vendor/hooks/use-vendor';
import { useLowStock } from '@/features/inventory/hooks/use-inventory';
import { useVendorOrders } from '@/features/orders/hooks/use-orders';
import { useVendorProducts } from '@/features/products/hooks/use-products';

interface StatCardProps {
  icon: typeof Package;
  label: string;
  value: number | undefined;
  loading: boolean;
  href: string;
  tone?: 'default' | 'warning';
}

function StatCard({ icon: Icon, label, value, loading, href, tone = 'default' }: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-sm font-semibold">{label}</CardTitle>
          <Icon
            className={tone === 'warning' ? 'text-sale size-4' : 'text-muted-foreground size-4'}
            aria-hidden
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="text-2xl font-extrabold tabular-nums">{value ?? '—'}</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const vendor = useVendor();
  const activeProducts = useVendorProducts({ page: 1, limit: 1, status: 'ACTIVE' });
  const pendingOrders = useVendorOrders({ page: 1, limit: 1, status: 'CONFIRMED' });
  const lowStock = useLowStock();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          Welcome back{vendor.vendor ? `, ${vendor.vendor.businessName}` : ''}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Here’s how your store is doing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Package}
          label="Live products"
          value={activeProducts.data?.meta.total}
          loading={activeProducts.isPending}
          href="/products"
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders to pack"
          value={pendingOrders.data?.meta.total}
          loading={pendingOrders.isPending}
          href="/orders"
        />
        <StatCard
          icon={Boxes}
          label="Low stock SKUs"
          value={lowStock.data?.length}
          loading={lowStock.isPending}
          href="/inventory"
          tone={(lowStock.data?.length ?? 0) > 0 ? 'warning' : 'default'}
        />
      </div>

      {(lowStock.data?.length ?? 0) > 0 && (
        <Card className="border-sale/30 bg-[oklch(0.97_0.015_85)]">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="text-sale size-5 shrink-0" aria-hidden />
            <p className="flex-1 text-sm">
              <strong>{lowStock.data?.length}</strong> SKU
              {lowStock.data?.length === 1 ? '' : 's'} at or below the reorder level.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/inventory">
                Review
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/products/new">List a product</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/orders">View orders</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings">Store settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
