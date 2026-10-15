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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReviewProduct } from '../hooks/use-products';
import type { ProductDetail } from '../types';

interface ReviewProductDialogProps {
  product: ProductDetail;
  decision: 'ACTIVE' | 'REJECTED' | null;
  onClose: () => void;
}

export function ReviewProductDialog({ product, decision, onClose }: ReviewProductDialogProps) {
  const [reason, setReason] = useState('');
  const review = useReviewProduct(product.id);

  if (!decision) return null;
  const isApprove = decision === 'ACTIVE';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isApprove ? 'Publish this listing' : 'Reject this listing'}</DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Makes the product and its variants visible on the storefront immediately.'
              : 'The vendor sees this reason and can resubmit after making changes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">{product.title}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-reason">{isApprove ? 'Note (optional)' : 'Reason'}</Label>
            <Textarea
              id="product-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={isApprove ? 'Internal note' : 'e.g. images do not match the title'}
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
            variant={isApprove ? 'default' : 'destructive'}
            disabled={review.isPending || (!isApprove && reason.trim().length === 0)}
            onClick={() => review.mutate({ status: decision, reason: reason || undefined }, { onSuccess: onClose })}
          >
            {review.isPending ? 'Saving…' : isApprove ? 'Publish' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
