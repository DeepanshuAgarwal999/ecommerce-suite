'use client';

import { Clock, Mail, ShieldAlert, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { siteConfig } from '@/config/site';
import { useLogout } from '@/features/auth/hooks/use-session';
import { useVendor } from '@/features/vendor/hooks/use-vendor';

const copy = {
  PENDING: {
    icon: Clock,
    title: 'Your application is in the queue',
    description: "We'll email you the moment review starts. Usually within 2 business days.",
  },
  UNDER_REVIEW: {
    icon: Clock,
    title: 'Your application is under review',
    description: 'Our team is verifying your details. This page updates automatically.',
  },
  REJECTED: {
    icon: XCircle,
    title: 'Your application was not approved',
    description: 'Reach out to seller support if you think this needs a second look.',
  },
  SUSPENDED: {
    icon: ShieldAlert,
    title: 'Your seller account is suspended',
    description: 'Contact seller support to understand why and what happens next.',
  },
} as const;

export default function PendingPage() {
  const vendor = useVendor();
  const logout = useLogout();

  if (vendor.isPending || !vendor.vendor) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border p-10">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const status = vendor.vendor.status as keyof typeof copy;
  const { icon, title, description } = copy[status] ?? copy.PENDING;

  return (
    <div className="bg-card rounded-2xl border p-6 sm:p-10">
      <EmptyState
        icon={icon}
        title={title}
        description={vendor.vendor.rejectionReason ?? description}
        action={
          <div className="flex flex-col items-center gap-3">
            <Button asChild variant="outline">
              <a href={`mailto:${siteConfig.support.email}`}>
                <Mail data-icon="inline-start" aria-hidden />
                Contact seller support
              </a>
            </Button>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="text-muted-foreground text-sm hover:underline"
            >
              Sign out
            </button>
          </div>
        }
      />
    </div>
  );
}
