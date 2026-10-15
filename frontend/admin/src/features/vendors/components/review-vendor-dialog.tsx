'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReviewVendor } from '../hooks/use-vendors';
import type { ReviewVendorInput, VendorWithUser } from '../types';

interface ReviewVendorDialogProps {
  vendor: VendorWithUser;
  decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null;
  onClose: () => void;
}

const COPY: Record<'APPROVED' | 'REJECTED' | 'SUSPENDED', { title: string; description: string; cta: string }> = {
  APPROVED: {
    title: 'Approve this seller',
    description: 'Grants the VENDOR role automatically — they can start listing products immediately.',
    cta: 'Approve vendor',
  },
  REJECTED: {
    title: 'Reject this application',
    description: 'The applicant can reapply once; explain what needs to change.',
    cta: 'Reject application',
  },
  SUSPENDED: {
    title: 'Suspend this seller',
    description: 'Immediately blocks new listings and order fulfilment for this vendor.',
    cta: 'Suspend vendor',
  },
};

/** One dialog reused for all three review decisions — only the copy and payload differ. */
export function ReviewVendorDialog({ vendor, decision, onClose }: ReviewVendorDialogProps) {
  const [reason, setReason] = useState('');
  const [commissionPercent, setCommissionPercent] = useState((vendor.commissionBps / 100).toString());
  const review = useReviewVendor(vendor.id);

  if (!decision) return null;
  const copy = COPY[decision];
  const requiresReason = decision !== 'APPROVED';

  function submit() {
    if (!decision) return;
    const input: ReviewVendorInput = { status: decision, reason: reason || undefined };
    if (decision === 'APPROVED') {
      const bps = Math.round(Number(commissionPercent) * 100);
      if (Number.isFinite(bps) && bps >= 0) input.commissionBps = bps;
    }
    review.mutate(input, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm">
            <span className="font-medium">{vendor.businessName}</span>{' '}
            <span className="text-muted-foreground">({vendor.vendorCode})</span>
          </p>

          {decision === 'APPROVED' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commission">Commission rate (%)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionPercent}
                onChange={(event) => setCommissionPercent(event.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">
              {requiresReason ? 'Reason' : 'Note (optional)'}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={requiresReason ? 'Shown to the seller — be specific.' : 'Internal note'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={decision === 'APPROVED' ? 'default' : 'destructive'}
            disabled={review.isPending || (requiresReason && reason.trim().length === 0)}
            onClick={submit}
          >
            {review.isPending ? 'Saving…' : copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
