'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
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
import { useCreateTheme, useUpdateTheme } from '../hooks/use-themes';
import { colorFields, themePresets, toLocalInput } from '../presets';
import type { StoreTheme, ThemeColors, ThemeInput, ThemePreset } from '../types';
import { ThemePreview } from './theme-preview';

interface ThemeFormDialogProps {
  theme: StoreTheme | null;
  mode: 'create' | 'edit';
  onClose: () => void;
}

/**
 * Create/edit an occasion theme. Colours start from the preset's built-in
 * palette; only the ones the admin actually changes are saved as overrides, so
 * a later storefront tweak to a preset still reaches themes that never touched it.
 */
export function ThemeFormDialog({ theme, mode, onClose }: ThemeFormDialogProps) {
  const [name, setName] = useState(theme?.name ?? '');
  const [preset, setPreset] = useState<ThemePreset>(theme?.preset ?? 'DIWALI');
  const [overrides, setOverrides] = useState<ThemeColors>(theme?.colors ?? {});
  const [announcement, setAnnouncement] = useState(theme?.announcement ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(theme?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(theme?.endsAt ?? null));
  const [priority, setPriority] = useState(String(theme?.priority ?? 0));
  const [isActive, setIsActive] = useState(theme?.isActive ?? true);

  const create = useCreateTheme();
  const update = useUpdateTheme();
  const isPending = create.isPending || update.isPending;

  const presetColors = themePresets[preset].colors;
  const colors: Required<ThemeColors> = { ...presetColors, ...overrides };
  const windowInvalid = Boolean(startsAt && endsAt && new Date(startsAt) >= new Date(endsAt));
  const valid = name.trim() !== '' && !windowInvalid;

  function setColor(key: keyof ThemeColors, value: string) {
    setOverrides((current) => {
      const next = { ...current };
      if (value.toLowerCase() === presetColors[key].toLowerCase()) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function submit() {
    const input: ThemeInput = {
      name: name.trim(),
      preset,
      colors: overrides,
      announcement: announcement.trim() || null,
      isActive,
      priority: Number.parseInt(priority, 10) || 0,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    };
    if (mode === 'create') create.mutate(input, { onSuccess: onClose });
    else if (theme) update.mutate({ id: theme.id, input }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New occasion theme' : `Edit "${theme?.name}"`}</DialogTitle>
          <DialogDescription>
            Re-skins the whole storefront for a festival: palette, garland, festive tiles and the announcement bar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_240px]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="theme-name">Name</Label>
                <Input
                  id="theme-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Diwali 2026"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="theme-preset">Occasion</Label>
                <Select value={preset} onValueChange={(value) => setPreset(value as ThemePreset)}>
                  <SelectTrigger id="theme-preset" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(themePresets) as ThemePreset[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {themePresets[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">{themePresets[preset].decor}</p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="theme-announcement">Announcement bar (optional)</Label>
              <Input
                id="theme-announcement"
                value={announcement}
                maxLength={160}
                onChange={(event) => setAnnouncement(event.target.value)}
                placeholder="Diwali Sale is live - upto 75% off"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Colours</Label>
                {Object.keys(overrides).length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOverrides({})}>
                    <RotateCcw className="size-3.5" aria-hidden />
                    Use preset colours
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {colorFields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 rounded-lg border border-border p-2"
                    title={field.hint}
                  >
                    <input
                      type="color"
                      value={colors[field.key]}
                      onChange={(event) => setColor(field.key, event.target.value)}
                      className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {field.label}
                        {overrides[field.key] && <span className="text-primary"> •</span>}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{field.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="theme-starts">Starts (optional)</Label>
                <Input id="theme-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="theme-ends">Ends (optional)</Label>
                <Input id="theme-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            {windowInvalid && <p className="-mt-2 text-xs text-destructive">The end must be after the start.</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="theme-priority">Priority</Label>
                <Input
                  id="theme-priority"
                  type="number"
                  min={-100}
                  max={100}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                />
              </div>
              <label className="flex items-center justify-between self-end rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium">Enabled</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Goes live automatically inside its window. If two windows overlap, the higher priority wins.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Preview</Label>
            <ThemePreview colors={colors} announcement={announcement || themePresets[preset].label} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || isPending} onClick={submit}>
            {isPending ? 'Saving…' : mode === 'create' ? 'Create theme' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
