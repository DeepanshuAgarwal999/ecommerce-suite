'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Mail, Package, Phone, Star } from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewVendorDialog } from '@/features/vendors/components/review-vendor-dialog';
import { useVendor } from '@/features/vendors/hooks/use-vendors';
import type { VendorStatus } from '@/features/vendors/types';
import { formatDate, formatDateTime } from '@/lib/format';

type Decision = 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** Which review actions make sense from each current status. */
const AVAILABLE_ACTIONS: Record<VendorStatus, Decision[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  REJECTED: [],
  SUSPENDED: ['APPROVED'],
};

export default function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const router = useRouter();
  const { data: vendor, isLoading } = useVendor(vendorId);
  const [decision, setDecision] = useState<Decision | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!vendor) {
    return <p className="text-sm text-muted-foreground">Vendor not found.</p>;
  }

  const actions = AVAILABLE_ACTIONS[vendor.status];

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => router.push('/vendors')}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to vendors
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
              {vendor.businessName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{vendor.businessName}</h2>
              <StatusBadge status={vendor.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {vendor.vendorCode} · Applied {formatDate(vendor.createdAt)}
            </p>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === 'APPROVED' ? 'default' : 'destructive'}
                onClick={() => setDecision(action)}
              >
                {action === 'APPROVED' ? 'Approve' : action === 'REJECTED' ? 'Reject' : 'Suspend'}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Business details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" value={vendor.legalName ?? '—'} />
            <Field label="GSTIN" value={vendor.gstin ?? '—'} mono />
            <Field label="PAN" value={vendor.pan ?? '—'} mono />
            <Field label="FSSAI licence" value={vendor.fssaiLicense ?? '—'} mono />
            <Field label="Commission" value={`${(vendor.commissionBps / 100).toFixed(1)}%`} />
            <Field
              label="Rating"
              value={
                vendor.ratingCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 fill-status-warning text-status-warning" aria-hidden />
                    {vendor.ratingAverage.toFixed(1)} ({vendor.ratingCount})
                  </span>
                ) : (
                  'No ratings yet'
                )
              }
            />

            {vendor.description && (
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{vendor.description}</p>
              </div>
            )}

            {vendor.status === 'REJECTED' && vendor.rejectionReason && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
                <span className="font-medium">Rejection reason: </span>
                {vendor.rejectionReason}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {vendor.user?.mobile && (
                <span className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  {vendor.user.mobile}
                </span>
              )}
              {vendor.supportEmail && (
                <span className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  {vendor.supportEmail}
                </span>
              )}
              {!vendor.user?.mobile && !vendor.supportEmail && (
                <span className="text-muted-foreground">No contact details on file.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catalogue</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/products?vendorId=${vendor.id}`}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Package className="size-4" aria-hidden />
                View this vendor&apos;s products
              </Link>
            </CardContent>
          </Card>

          {vendor.reviewedAt && (
            <Card>
              <CardHeader>
                <CardTitle>Review history</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Last reviewed {formatDateTime(vendor.reviewedAt)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {vendor.documents && vendor.documents.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>KYC documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {vendor.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{doc.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                </div>
                <StatusBadge status={doc.verified ? 'APPROVED' : 'PENDING'} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ReviewVendorDialog vendor={vendor} decision={decision} onClose={() => setDecision(null)} />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</p>
    </div>
  );
}
