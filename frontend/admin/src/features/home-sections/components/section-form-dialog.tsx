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
import { ThemeSelect } from '@/features/themes/components/theme-select';
import { toLocalInput } from '@/features/themes/presets';
import { useCreateSection, useUpdateSection } from '../hooks/use-home-sections';
import { sectionLayouts, sortOptions } from '../layouts';
import type { HomeSection, HomeSectionInput, SectionConfig, SectionLayout } from '../types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Radix Select can't hold an empty string, so "no category" uses a sentinel. */
const ANY = '__any__';

interface SectionFormDialogProps {
  section: HomeSection | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function SectionFormDialog({ section, mode, onClose }: SectionFormDialogProps) {
  const [title, setTitle] = useState(section?.title ?? '');
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? '');
  const [slug, setSlug] = useState(section?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [isActive, setIsActive] = useState(section?.isActive ?? true);
  const [layout, setLayout] = useState<SectionLayout>(section?.layout ?? 'TILE_GRID');
  const [config, setConfig] = useState<SectionConfig>(section?.config ?? {});
  const [themeId, setThemeId] = useState<string | null>(section?.themeId ?? null);
  const [startsAt, setStartsAt] = useState(toLocalInput(section?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(section?.endsAt ?? null));

  const categories = useCategories();
  const create = useCreateSection();
  const update = useUpdateSection();
  const isPending = create.isPending || update.isPending;
  const valid = title.trim() !== '' && slug.trim() !== '';

  const productBacked = layout === 'PRODUCT_GRID' || layout === 'DEAL_OF_DAY' || layout === 'PRODUCT_TABS';

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function setConfigValue<K extends keyof SectionConfig>(key: K, value: SectionConfig[K] | undefined) {
    setConfig((current) => {
      const next = { ...current };
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function submit() {
    const input: HomeSectionInput = {
      title,
      subtitle: subtitle || undefined,
      slug,
      layout,
      config,
      themeId,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isActive,
    };
    if (mode === 'create') {
      create.mutate(input, { onSuccess: onClose });
    } else if (section) {
      update.mutate({ id: section.id, input }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New home page section' : 'Edit section'}</DialogTitle>
          <DialogDescription>
            A block on the home page - image tiles, promo banners, a product grid, tabbed products or a deal of the day.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="section-layout">Layout</Label>
            <Select value={layout} onValueChange={(value) => setLayout(value as SectionLayout)}>
              <SelectTrigger id="section-layout" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(sectionLayouts) as SectionLayout[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {sectionLayouts[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{sectionLayouts[layout].description}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section-title">Title</Label>
              <Input
                id="section-title"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Diwali hosting needs"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section-subtitle">Subtitle (optional)</Label>
              <Input
                id="section-subtitle"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Serveware for a full house"
              />
            </div>
          </div>

          {/* --- layout-specific settings ------------------------------------ */}
          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            {layout === 'TILE_GRID' && (
              <div className="flex flex-col gap-1.5">
                <Label>Tile shape</Label>
                <Select
                  value={config.tileShape ?? 'square'}
                  onValueChange={(value) => setConfigValue('tileShape', value as SectionConfig['tileShape'])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Rounded square</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="arch">Festive arch (jharokha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {layout !== 'SPLIT_BANNERS' && (
              <div className="flex flex-col gap-1.5">
                <Label>Background</Label>
                <Select
                  value={config.tone ?? (layout === 'DEAL_OF_DAY' ? 'wash' : 'plain')}
                  onValueChange={(value) => setConfigValue('tone', value as SectionConfig['tone'])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plain">Plain</SelectItem>
                    <SelectItem value="wash">Soft tinted band</SelectItem>
                    <SelectItem value="festive">Festive deep band</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(layout === 'PRODUCT_GRID' || layout === 'DEAL_OF_DAY') && (
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={config.categoryId ?? ANY}
                  onValueChange={(value) => setConfigValue('categoryId', value === ANY ? undefined : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All categories</SelectItem>
                    {categories.data?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {productBacked && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Sort products by</Label>
                  <Select
                    value={config.sort ?? 'popular'}
                    onValueChange={(value) => setConfigValue('sort', value as SectionConfig['sort'])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="section-limit">{layout === 'PRODUCT_TABS' ? 'Products per tab' : 'Products to show'}</Label>
                  <Input
                    id="section-limit"
                    type="number"
                    min={2}
                    max={24}
                    value={config.limit ?? ''}
                    placeholder={layout === 'DEAL_OF_DAY' ? '10' : layout === 'PRODUCT_TABS' ? '6' : '8'}
                    onChange={(event) =>
                      setConfigValue('limit', event.target.value ? Math.min(24, Math.max(2, Number(event.target.value))) : undefined)
                    }
                  />
                </div>
              </>
            )}

            {layout === 'DEAL_OF_DAY' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="section-countdown">Countdown ends (optional)</Label>
                <Input
                  id="section-countdown"
                  type="datetime-local"
                  value={toLocalInput(config.countdownEndsAt ?? null)}
                  onChange={(event) =>
                    setConfigValue(
                      'countdownEndsAt',
                      event.target.value ? new Date(event.target.value).toISOString() : undefined,
                    )
                  }
                />
                <p className="text-[11px] text-muted-foreground">Blank = resets every midnight (IST).</p>
              </div>
            )}

            {(layout === 'TILE_GRID' || layout === 'PRODUCT_GRID') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="section-viewall">"View all" link (optional)</Label>
                <Input
                  id="section-viewall"
                  value={config.viewAllUrl ?? ''}
                  onChange={(event) => setConfigValue('viewAllUrl', event.target.value || undefined)}
                  placeholder="/c/kitchen-dining"
                />
              </div>
            )}

            {layout === 'SPLIT_BANNERS' && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                No extra settings - add up to three banners as tiles. The first is the large one.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Show during</Label>
            <ThemeSelect value={themeId} onChange={setThemeId} />
            <p className="text-xs text-muted-foreground">
              Tie it to an occasion theme and it appears and disappears with that theme.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section-starts">Starts (optional)</Label>
              <Input id="section-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section-ends">Ends (optional)</Label>
              <Input id="section-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="section-slug">Slug</Label>
            <Input
              id="section-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              placeholder="diwali-hosting-needs"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Internal identifier only - never shown to customers.</p>
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
            {isPending ? 'Saving…' : mode === 'create' ? 'Create section' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
