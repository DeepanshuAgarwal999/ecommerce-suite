'use client';

import { redirect, usePathname } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { useIsRestoringSession, useIsSignedIn } from '@/features/auth/hooks/use-session';
import { useVendor } from '../hooks/use-vendor';
import type { VendorStatus } from '../types';

const APPROVED_SECTION = '/';
const APPLY_PATH = '/apply';
const PENDING_PATH = '/pending';
const LOGIN_PATH = '/login';

/** Where an account at a given vendor status belongs. No vendor row at all is
 *  represented as `null` and routes to APPLY_PATH. */
function destinationFor(status: VendorStatus | null): string {
  switch (status) {
    case 'APPROVED':
      return APPROVED_SECTION;
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'REJECTED':
    case 'SUSPENDED':
      return PENDING_PATH;
    default:
      return APPLY_PATH;
  }
}

/**
 * Gatekeeper mounted in both the (onboarding) and (console) layouts. Resolves
 * sign-in state and vendor status once and redirects anyone on the wrong
 * section of the app — someone approved who lands on /apply goes straight to
 * the dashboard; someone who has not applied yet is bounced off every console
 * route back to /apply.
 */
export function VendorGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const restoring = useIsRestoringSession();
  const signedIn = useIsSignedIn();
  const vendor = useVendor();

  if (restoring || (signedIn && vendor.isPending)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="text-primary size-6" />
      </div>
    );
  }

  if (!signedIn) redirect(LOGIN_PATH);

  const destination = destinationFor(vendor.vendor?.status ?? null);
  const onRightSection =
    destination === APPROVED_SECTION ? pathname !== APPLY_PATH && pathname !== PENDING_PATH : pathname === destination;

  if (!onRightSection) redirect(destination);

  return <>{children}</>;
}
