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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/features/products/hooks/use-products';
import { useCreateTile, useUpdateTile } from '../hooks/use-home-sections';
import { sectionLayouts } from '../layouts';
import type { SectionLayout, SectionTile, SectionTileInput } from '../types';

interface TileFormDialogProps {
  sectionId: string;
  /** The parent section's layout - decides which extra fields a tile needs. */
  layout: SectionLayout;
  tile: SectionTile | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function TileFormDialog({ sectionId, layout, tile, mode, onClose }: TileFormDialogProps) {
  const [title, setTitle] = useState(tile?.title ?? '');
  const [subtitle, setSubtitle] = useState(tile?.subtitle ?? '');
  const [ctaLabel, setCtaLabel] = useState(tile?.ctaLabel ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(tile?.categoryId ?? null);
  const categories = useCategories();
  const noun = sectionLayouts[layout].tiles?.noun ?? 'tile';
  const [imageUrl, setImageUrl] = useState(tile?.imageUrl ?? '');
  const [imageAlt, setImageAlt] = useState(tile?.imageAlt ?? '');
  const [linkUrl, setLinkUrl] = useState(tile?.linkUrl ?? '');
  const [isActive, setIsActive] = useState(tile?.isActive ?? true);

  const create = useCreateTile(sectionId);
  const update = useUpdateTile(sectionId);
  const isPending = create.isPending || update.isPending;
  const valid =
    title.trim() !== '' &&
    imageUrl.trim() !== '' &&
    imageAlt.trim() !== '' &&
    linkUrl.trim() !== '' &&
    (layout !== 'PRODUCT_TABS' || categoryId !== null);

  function submit() {
    const input: SectionTileInput = {
      title,
      imageUrl,
      imageAlt,
      linkUrl,
      isActive,
      subtitle: layout === 'SPLIT_BANNERS' ? subtitle.trim() || null : undefined,
      ctaLabel: layout === 'SPLIT_BANNERS' ? ctaLabel.trim() || null : undefined,
      categoryId: layout === 'PRODUCT_TABS' ? categoryId : undefined,
    };
    if (mode === 'create') {
      create.mutate(input, { onSuccess: onClose });
    } else if (tile) {
      update.mutate({ tileId: tile.id, input }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? `Add a ${noun}` : `Edit ${noun}`}</DialogTitle>
          <DialogDescription>{sectionLayouts[layout].tiles?.hint}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tile-image">Image URL</Label>
            <Input
              id="tile-image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://…"
              autoFocus
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mt-1 aspect-square w-24 rounded-xl border border-border object-cover"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tile-title">Title</Label>
            <Input
              id="tile-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Diwali"
            />
          </div>

          {layout === 'SPLIT_BANNERS' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tile-subtitle">Offer line</Label>
                <Input
                  id="tile-subtitle"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  placeholder="Upto 45% off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tile-cta">Button text</Label>
                <Input
                  id="tile-cta"
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  placeholder="Shop now"
                />
              </div>
            </div>
          )}

          {layout === 'PRODUCT_TABS' && (
            <div className="flex flex-col gap-1.5">
              <Label>Products from category</Label>
              <Select value={categoryId ?? undefined} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose the category this tab lists" />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tile-alt">Image alt text</Label>
            <Input
              id="tile-alt"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder="Describe the image"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tile-link">Links to</Label>
            <Input
              id="tile-link"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="/c/diwali-decor"
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || isPending} onClick={submit}>
            {isPending ? 'Saving…' : mode === 'create' ? `Add ${noun}` : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
