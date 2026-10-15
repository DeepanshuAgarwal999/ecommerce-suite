'use client';

import { useState } from 'react';
import { CalendarClock, Pencil, Plus, Power, PowerOff, Radio, Trash2 } from 'lucide-react';
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
import { formatDateTime } from '@/lib/format';
import { useDeleteTheme, useLiveTheme, useThemes, useUpdateTheme } from '../hooks/use-themes';
import { scheduleState, themePresets } from '../presets';
import type { StoreTheme } from '../types';
import { ThemeFormDialog } from './theme-form-dialog';

function statusOf(theme: StoreTheme, liveId: string | undefined) {
  if (theme.id === liveId) return { label: 'Live now', variant: 'default' as const };
  if (!theme.isActive) return { label: 'Off', variant: 'secondary' as const };
  const state = scheduleState(theme);
  if (state === 'scheduled') return { label: 'Scheduled', variant: 'outline' as const };
  if (state === 'ended') return { label: 'Ended', variant: 'secondary' as const };
  // Enabled and in its window, but another theme outranks it.
  return { label: 'Outranked', variant: 'outline' as const };
}

export function ThemeList() {
  const { data: themes, isLoading } = useThemes();
  const { data: live } = useLiveTheme();
  const update = useUpdateTheme();
  const remove = useDeleteTheme();

  const [editing, setEditing] = useState<StoreTheme | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StoreTheme | null>(null);

  /** Start now, keep a future end date, and outrank everything else. */
  function goLive(theme: StoreTheme) {
    const topPriority = Math.max(0, ...(themes ?? []).map((item) => item.priority));
    const endInFuture = theme.endsAt && Date.parse(theme.endsAt) > Date.now();
    update.mutate({
      id: theme.id,
      input: {
        isActive: true,
        startsAt: new Date().toISOString(),
        endsAt: endInFuture ? theme.endsAt : null,
        priority: theme.id === live?.id ? theme.priority : Math.min(100, topPriority + 1),
      },
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
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Radio className="size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">
                Storefront is wearing: {live ? live.name : 'the everyday theme'}
              </p>
              <p className="text-xs text-muted-foreground">
                {live
                  ? `${themePresets[live.preset].label}${live.endsAt ? ` · until ${formatDateTime(live.endsAt)}` : ''}`
                  : 'No occasion theme is live. Scheduled themes switch on by themselves.'}
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            New theme
          </Button>
        </CardContent>
      </Card>

      {!themes || themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No occasion themes yet. Create one for the next festival - Diwali, Holi, Independence Day - and schedule it.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {themes.map((theme) => {
            const status = statusOf(theme, live?.id);
            const colors = { ...themePresets[theme.preset].colors, ...theme.colors };
            const isLive = theme.id === live?.id;

            return (
              <Card key={theme.id} className={isLive ? 'ring-2 ring-primary' : undefined}>
                <CardContent className="flex gap-4 py-4">
                  <div className="grid h-16 w-12 shrink-0 grid-rows-3 overflow-hidden rounded-md border" aria-hidden>
                    <span style={{ background: colors.brandDark }} />
                    <span style={{ background: colors.surface, borderTop: `2px solid ${colors.gold}` }} />
                    <span style={{ background: colors.primary }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{theme.name}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {theme.priority !== 0 && (
                        <span className="text-xs text-muted-foreground">priority {theme.priority}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{themePresets[theme.preset].label}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {theme.startsAt ? formatDateTime(theme.startsAt) : 'Any time'} →{' '}
                      {theme.endsAt ? formatDateTime(theme.endsAt) : 'no end'}
                    </p>
                    {theme.announcement && (
                      <p className="mt-1 truncate text-xs italic text-muted-foreground">“{theme.announcement}”</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isLive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: theme.id, input: { isActive: false } })}
                        >
                          <PowerOff className="size-3.5" aria-hidden />
                          Switch off
                        </Button>
                      ) : (
                        <Button type="button" size="sm" disabled={update.isPending} onClick={() => goLive(theme)}>
                          <Power className="size-3.5" aria-hidden />
                          Go live now
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(theme)}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(theme)}>
                        <Trash2 className="size-3.5 text-destructive" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating && <ThemeFormDialog theme={null} mode="create" onClose={() => setCreating(false)} />}
      {editing && <ThemeFormDialog theme={editing} mode="edit" onClose={() => setEditing(null)} />}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{deleting.name}"?</DialogTitle>
              <DialogDescription>
                Banners and sections tied to this theme are kept, but will then show all the time. Switch them off
                first if they are festival-only.
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
                {remove.isPending ? 'Deleting…' : 'Delete theme'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
