'use client';

import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/hooks/use-session';
import { useVendor } from '@/features/vendor/hooks/use-vendor';
import { formatMobile } from '@/lib/validations/auth';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  );
}

export default function SettingsPage() {
  const vendor = useVendor();
  const session = useSession();

  return (
    <>
      <PageHeader title="Store settings" description="Your business profile and contact details." />

      <Card className="max-w-2xl">
        <CardContent className="divide-border divide-y pt-6">
          {vendor.isPending ? (
            <div className="flex flex-col gap-3 py-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            vendor.vendor && (
              <>
                <Row label="Status" value={<StatusBadge status={vendor.vendor.status} />} />
                <Row label="Vendor code" value={<span className="font-mono">{vendor.vendor.vendorCode}</span>} />
                <Row label="Business name" value={vendor.vendor.businessName} />
                <Row label="Legal name" value={vendor.vendor.legalName} />
                <Row label="GSTIN" value={vendor.vendor.gstin} />
                <Row label="PAN" value={vendor.vendor.pan} />
                <Row label="Support email" value={vendor.vendor.supportEmail} />
                <Row label="Support phone" value={vendor.vendor.supportPhone} />
                {vendor.vendor.commissionBps !== undefined && (
                  <Row label="Platform commission" value={`${vendor.vendor.commissionBps / 100}%`} />
                )}
              </>
            )
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card className="max-w-2xl">
        <CardContent className="divide-border divide-y pt-6">
          <Row label="Sign-in number" value={session.user && formatMobile(session.user.mobile, session.user.countryCode)} />
        </CardContent>
      </Card>
    </>
  );
}
