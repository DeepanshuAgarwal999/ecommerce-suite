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
import { Switch } from '@/components/ui/switch';
import { ThemeSelect } from '@/features/themes/components/theme-select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBanner, useUpdateBanner } from '../hooks/use-banners';
import type { Banner, BannerInput } from '../types';

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" with no timezone/seconds. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

function emptyForm(): BannerInput {
  return {
    eyebrow: '',
    headline: '',
    subcopy: '',
    ctaLabel: '',
    linkUrl: '',
    imageUrl: '',
    imageAlt: '',
    imagePosition: '',
    isActive: true,
    startsAt: '',
    endsAt: '',
    themeId: null,
  };
}

function toForm(banner: Banner): BannerInput {
  return {
    eyebrow: banner.eyebrow ?? '',
    headline: banner.headline ?? '',
    subcopy: banner.subcopy ?? '',
    ctaLabel: banner.ctaLabel ?? '',
    linkUrl: banner.linkUrl,
    imageUrl: banner.imageUrl,
    imageAlt: banner.imageAlt,
    imagePosition: banner.imagePosition ?? '',
    isActive: banner.isActive,
    startsAt: toLocalInput(banner.startsAt),
    endsAt: toLocalInput(banner.endsAt),
    themeId: banner.themeId,
  };
}

/** Strips empty-string optional fields so a blank input clears rather than sends "". */
function cleanPayload(form: BannerInput): BannerInput {
  const cleaned: BannerInput = { linkUrl: form.linkUrl, imageUrl: form.imageUrl, imageAlt: form.imageAlt };
  if (form.eyebrow) cleaned.eyebrow = form.eyebrow;
  if (form.headline) cleaned.headline = form.headline;
  if (form.subcopy) cleaned.subcopy = form.subcopy;
  if (form.ctaLabel) cleaned.ctaLabel = form.ctaLabel;
  if (form.imagePosition) cleaned.imagePosition = form.imagePosition;
  if (form.startsAt) cleaned.startsAt = new Date(form.startsAt).toISOString();
  if (form.endsAt) cleaned.endsAt = new Date(form.endsAt).toISOString();
  cleaned.isActive = form.isActive;
  cleaned.themeId = form.themeId ?? null;
  return cleaned;
}

interface BannerFormDialogProps {
  banner: Banner | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function BannerFormDialog({ banner, mode, onClose }: BannerFormDialogProps) {
  const [form, setForm] = useState<BannerInput>(banner ? toForm(banner) : emptyForm());
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const isPending = create.isPending || update.isPending;

  const valid = form.linkUrl.trim() !== '' && form.imageUrl.trim() !== '' && form.imageAlt.trim() !== '';

  function set<K extends keyof BannerInput>(key: K, value: BannerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const payload = cleanPayload(form);
    if (mode === 'create') {
      create.mutate(payload, { onSuccess: onClose });
    } else if (banner) {
      update.mutate({ id: banner.id, input: payload }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add a banner' : 'Edit banner'}</DialogTitle>
          <DialogDescription>One slide in the home page hero carousel.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-image">Image URL</Label>
            <Input
              id="banner-image"
              value={form.imageUrl}
              onChange={(event) => set('imageUrl', event.target.value)}
              placeholder="https://…"
            />
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt=""
                className="mt-1 h-28 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-alt">Image alt text</Label>
              <Input
                id="banner-alt"
                value={form.imageAlt}
                onChange={(event) => set('imageAlt', event.target.value)}
                placeholder="Describe the image"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-position">Image position</Label>
              <Input
                id="banner-position"
                value={form.imagePosition}
                onChange={(event) => set('imagePosition', event.target.value)}
                placeholder="e.g. 72% 60%"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-eyebrow">Eyebrow (small label)</Label>
            <Input
              id="banner-eyebrow"
              value={form.eyebrow}
              onChange={(event) => set('eyebrow', event.target.value)}
              placeholder="FESTIVE EDIT"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-headline">Headline</Label>
            <Input
              id="banner-headline"
              value={form.headline}
              onChange={(event) => set('headline', event.target.value)}
              placeholder="Up to 70% off everything for home"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-subcopy">Subcopy</Label>
            <Textarea
              id="banner-subcopy"
              value={form.subcopy}
              onChange={(event) => set('subcopy', event.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-cta">Button label</Label>
              <Input
                id="banner-cta"
                value={form.ctaLabel}
                onChange={(event) => set('ctaLabel', event.target.value)}
                placeholder="Shop the edit"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-link">Links to</Label>
              <Input
                id="banner-link"
                value={form.linkUrl}
                onChange={(event) => set('linkUrl', event.target.value)}
                placeholder="/c/festive-sale"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-starts">Starts (optional)</Label>
              <Input
                id="banner-starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-ends">Ends (optional)</Label>
              <Input
                id="banner-ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => set('endsAt', event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Show during</Label>
            <ThemeSelect value={form.themeId ?? null} onChange={(themeId) => set('themeId', themeId)} />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={form.isActive} onCheckedChange={(checked) => set('isActive', checked)} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || isPending} onClick={submit}>
            {isPending ? 'Saving…' : mode === 'create' ? 'Add banner' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
