'use client';

import { AlertTriangle, Package, ShoppingCart, Store } from 'lucide-react';
import { ExportButton } from '@/components/common/export-button';
import { PageHeader } from '@/components/layout/page-header';
import { buildDashboardExport } from '@/features/dashboard/export';
import { OrderTrendChart } from '@/features/dashboard/components/order-trend-chart';
import { StatusBreakdownChart } from '@/features/dashboard/components/status-breakdown-chart';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { useDashboardOverview, useOrderTrend } from '@/features/dashboard/hooks/use-dashboard';
import { InsightsHighlights } from '@/features/insights/components/insights-highlights';

export default function DashboardPage() {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: trend, isLoading: trendLoading } = useOrderTrend(14);

  const pendingVendors = overview?.vendors.byStatus.find((s) => s.status === 'Pending')?.count ?? 0;
  const pendingProducts = overview?.products.byStatus.find((s) => s.status === 'Pending review')?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live read on sellers, catalogue and stock health."
        actions={
          <ExportButton
            label="Download report"
            filenameBase="dashboard-report"
            onBuild={async () => {
              if (!overview) return { sheets: [] };
              return buildDashboardExport(overview, trend ?? []);
            }}
          />
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vendors awaiting review"
          value={pendingVendors}
          icon={Store}
          href="/vendors?status=PENDING"
          isLoading={overviewLoading}
          tone={pendingVendors > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Products awaiting review"
          value={pendingProducts}
          icon={Package}
          href="/products?status=PENDING_REVIEW"
          isLoading={overviewLoading}
          tone={pendingProducts > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="SKUs below reorder level"
          value={overview?.lowStockCount ?? 0}
          icon={AlertTriangle}
          href="/inventory"
          isLoading={overviewLoading}
          tone={(overview?.lowStockCount ?? 0) > 0 ? 'destructive' : 'default'}
        />
        <KpiCard
          label="Total orders"
          value={overview?.orders.total ?? 0}
          icon={ShoppingCart}
          href="/orders"
          isLoading={overviewLoading}
        />
      </div>

      <div className="mb-4">
        <OrderTrendChart data={trend ?? []} isLoading={trendLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatusBreakdownChart
          title="Vendors by status"
          data={overview?.vendors.byStatus ?? []}
          isLoading={overviewLoading}
        />
        <StatusBreakdownChart
          title="Products by status"
          data={overview?.products.byStatus ?? []}
          isLoading={overviewLoading}
        />
        <StatusBreakdownChart
          title="Orders by status"
          data={overview?.orders.byStatus ?? []}
          isLoading={overviewLoading}
        />
      </div>

      <InsightsHighlights />
    </>
  );
}
