'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemes } from '@/features/themes/hooks/use-themes';
import { sectionLayouts } from '../layouts';
import { SectionFormDialog } from './section-form-dialog';
import { TileFormDialog } from './tile-form-dialog';
import {
  useDeleteSection,
  useDeleteTile,
  useHomeSections,
  useReorderSections,
  useReorderTiles,
} from '../hooks/use-home-sections';
import type { HomeSection, SectionTile } from '../types';

export function SectionList() {
  const { data: sections, isLoading } = useHomeSections();
  const reorderSections = useReorderSections();
  const deleteSection = useDeleteSection();
  const { data: themes } = useThemes();
  const themeName = (id: string | null) => themes?.find((theme) => theme.id === id)?.name;

  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [creatingSection, setCreatingSection] = useState(false);
  const [deletingSection, setDeletingSection] = useState<HomeSection | null>(null);

  function moveSection(index: number, direction: -1 | 1) {
    if (!sections) return;
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;

    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    reorderSections.mutate({
      items: reordered.map((section, position) => ({ id: section.id, displayOrder: position })),
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setCreatingSection(true)}>
          <Plus className="size-4" aria-hidden />
          New section
        </Button>
      </div>

      {!sections || sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No home page sections yet. Create one - image tiles, a product grid, a deal of the day...
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section, index) => (
            <Card key={section.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <Badge variant={section.isActive ? 'outline' : 'secondary'}>
                      {section.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="secondary">{sectionLayouts[section.layout ?? 'TILE_GRID'].label}</Badge>
                    {section.themeId && (
                      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                        {themeName(section.themeId) ?? 'Theme'} only
                      </Badge>
                    )}
                  </div>
                  {section.subtitle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{section.subtitle}</p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{section.slug}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0 || reorderSections.isPending}
                    onClick={() => moveSection(index, -1)}
                    aria-label="Move section up"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === sections.length - 1 || reorderSections.isPending}
                    onClick={() => moveSection(index, 1)}
                    aria-label="Move section down"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingSection(section)}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDeletingSection(section)}>
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TileGrid section={section} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creatingSection && (
        <SectionFormDialog section={null} mode="create" onClose={() => setCreatingSection(false)} />
      )}
      {editingSection && (
        <SectionFormDialog section={editingSection} mode="edit" onClose={() => setEditingSection(null)} />
      )}

      {deletingSection && (
        <Dialog open onOpenChange={(open) => !open && setDeletingSection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{deletingSection.title}"?</DialogTitle>
              <DialogDescription>
                This also deletes all {deletingSection.tiles.length} tile(s) inside it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingSection(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSection.isPending}
                onClick={() =>
                  deleteSection.mutate(deletingSection.id, { onSuccess: () => setDeletingSection(null) })
                }
              >
                {deleteSection.isPending ? 'Deleting…' : 'Delete section'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TileGrid({ section }: { section: HomeSection }) {
  const layout = sectionLayouts[section.layout ?? 'TILE_GRID'];
  const reorderTiles = useReorderTiles(section.id);
  const deleteTile = useDeleteTile(section.id);

  const [editingTile, setEditingTile] = useState<SectionTile | null>(null);
  const [creatingTile, setCreatingTile] = useState(false);
  const [deletingTile, setDeletingTile] = useState<SectionTile | null>(null);

  function moveTile(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= section.tiles.length) return;

    const reordered = [...section.tiles];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    reorderTiles.mutate({
      items: reordered.map((tile, position) => ({ id: tile.id, displayOrder: position })),
    });
  }

  if (!layout.tiles) {
    return (
      <p className="text-sm text-muted-foreground">
        No tiles needed - this section shows products automatically from its settings.
      </p>
    );
  }
  const full = section.layout === 'SPLIT_BANNERS' && section.tiles.length >= 3;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {section.tiles.map((tile, index) => (
          <div key={tile.id} className="group relative w-24">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              <img src={tile.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
              {!tile.isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Badge variant="secondary" className="text-[10px]">
                    Inactive
                  </Badge>
                </div>
              )}
            </div>
            <p className="mt-1 truncate text-center text-xs font-medium">{tile.title}</p>

            <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="size-6 shadow-sm"
                disabled={index === 0 || reorderTiles.isPending}
                onClick={() => moveTile(index, -1)}
                aria-label="Move left"
              >
                <ArrowUp className="size-3 -rotate-90" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="size-6 shadow-sm"
                onClick={() => setEditingTile(tile)}
                aria-label="Edit tile"
              >
                <Pencil className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="size-6 shadow-sm"
                onClick={() => setDeletingTile(tile)}
                aria-label="Delete tile"
              >
                <Trash2 className="size-3 text-destructive" aria-hidden />
              </Button>
            </div>
          </div>
        ))}

        {!full && (
        <button
          type="button"
          onClick={() => setCreatingTile(true)}
          className="flex aspect-square w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="size-5" aria-hidden />
          <span className="text-xs font-medium">Add {layout.tiles.noun}</span>
        </button>
        )}
      </div>

      {creatingTile && (
        <TileFormDialog sectionId={section.id} layout={section.layout ?? 'TILE_GRID'} tile={null} mode="create" onClose={() => setCreatingTile(false)} />
      )}
      {editingTile && (
        <TileFormDialog
          sectionId={section.id}
          layout={section.layout ?? 'TILE_GRID'}
          tile={editingTile}
          mode="edit"
          onClose={() => setEditingTile(null)}
        />
      )}

      {deletingTile && (
        <Dialog open onOpenChange={(open) => !open && setDeletingTile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove "{deletingTile.title}"?</DialogTitle>
              <DialogDescription>It disappears from this section immediately.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingTile(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteTile.isPending}
                onClick={() => deleteTile.mutate(deletingTile.id, { onSuccess: () => setDeletingTile(null) })}
              >
                {deleteTile.isPending ? 'Removing…' : 'Remove tile'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
