'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { BannerFormDialog } from './banner-form-dialog';
import { useBanners, useDeleteBanner, useReorderBanners } from '../hooks/use-banners';
import type { Banner } from '../types';

export function BannerList() {
  const { data: banners, isLoading } = useBanners();
  const reorder = useReorderBanners();
  const remove = useDeleteBanner();

  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Banner | null>(null);

  function move(index: number, direction: -1 | 1) {
    if (!banners) return;
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;

    const reordered = [...banners];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    reorder.mutate({
      items: reordered.map((banner, position) => ({ id: banner.id, displayOrder: position })),
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Add banner
        </Button>
      </div>

      {!banners || banners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No banners yet — the storefront falls back to its default slides until you add one.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {banners.map((banner, index) => (
            <Card key={banner.id}>
              <CardContent className="flex items-center gap-4 py-1">
                <img
                  src={banner.imageUrl}
                  alt=""
                  className="h-16 w-28 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{banner.headline || '(no headline)'}</p>
                    <Badge variant={banner.isActive ? 'outline' : 'secondary'}>
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {banner.eyebrow && `${banner.eyebrow} · `}
                    Links to {banner.linkUrl}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === banners.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(banner)}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(banner)}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && <BannerFormDialog banner={null} mode="create" onClose={() => setCreating(false)} />}
      {editing && <BannerFormDialog banner={editing} mode="edit" onClose={() => setEditing(null)} />}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this banner?</DialogTitle>
              <DialogDescription>
                It disappears from the storefront immediately. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
              >
                {remove.isPending ? 'Deleting…' : 'Delete banner'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
