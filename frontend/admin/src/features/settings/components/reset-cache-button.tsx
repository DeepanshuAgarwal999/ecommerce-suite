'use client';

import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useResetCache } from '../hooks/use-settings';

/**
 * Wipes the whole Redis cache — rate-limit counters, OTP codes in flight, and
 * every service's warm cache. No business data lives in Redis (Postgres is
 * the system of record), so nothing is lost, but it does sign every active
 * user's rate-limit budget back to zero and forces a cold-cache moment
 * platform-wide. Confirmed behind a dialog on purpose; the backend itself
 * restricts the route to SUPER_ADMIN.
 */
export function ResetCacheButton() {
  const [open, setOpen] = useState(false);
  const reset = useResetCache();

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <RotateCcw className="size-4" aria-hidden />
        Reset Redis cache
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" aria-hidden />
              Reset the entire Redis cache?
            </DialogTitle>
            <DialogDescription>
              This clears every rate-limit counter, every OTP code currently in
              flight, and every service&apos;s warm cache across the whole
              platform — not just your own session. No orders, products or
              accounts are affected; everyone just gets a clean rate-limit
              budget and a cold cache for a moment.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, { onSuccess: () => setOpen(false) })}
            >
              {reset.isPending ? 'Resetting…' : 'Reset cache'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
