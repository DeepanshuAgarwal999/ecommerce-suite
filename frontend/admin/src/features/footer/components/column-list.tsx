'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { ColumnFormDialog } from './column-form-dialog';
import { LinkFormDialog } from './link-form-dialog';
import {
  useDeleteColumn,
  useDeleteLink,
  useFooter,
  useReorderColumns,
  useReorderLinks,
} from '../hooks/use-footer';
import type { FooterColumn, FooterLink } from '../types';

export function ColumnList() {
  const { data, isLoading } = useFooter();
  const columns = data?.columns;
  const reorderColumns = useReorderColumns();
  const deleteColumn = useDeleteColumn();

  const [editingColumn, setEditingColumn] = useState<FooterColumn | null>(null);
  const [creatingColumn, setCreatingColumn] = useState(false);
  const [deletingColumn, setDeletingColumn] = useState<FooterColumn | null>(null);

  function moveColumn(index: number, direction: -1 | 1) {
    if (!columns) return;
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;

    const reordered = [...columns];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    reorderColumns.mutate({
      items: reordered.map((column, position) => ({ id: column.id, displayOrder: position })),
    });
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setCreatingColumn(true)}>
          <Plus className="size-4" aria-hidden />
          New column
        </Button>
      </div>

      {!columns || columns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No footer columns yet — create one for each link group, e.g. "Bedroom Decor" or "Policies".
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column, index) => (
            <Card key={column.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="truncate text-base">{column.title}</CardTitle>
                    <Badge variant={column.isActive ? 'outline' : 'secondary'}>
                      {column.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0 || reorderColumns.isPending}
                    onClick={() => moveColumn(index, -1)}
                    aria-label="Move column up"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === columns.length - 1 || reorderColumns.isPending}
                    onClick={() => moveColumn(index, 1)}
                    aria-label="Move column down"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingColumn(column)}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDeletingColumn(column)}>
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <LinkRows column={column} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creatingColumn && (
        <ColumnFormDialog column={null} mode="create" onClose={() => setCreatingColumn(false)} />
      )}
      {editingColumn && (
        <ColumnFormDialog column={editingColumn} mode="edit" onClose={() => setEditingColumn(null)} />
      )}

      {deletingColumn && (
        <Dialog open onOpenChange={(open) => !open && setDeletingColumn(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{deletingColumn.title}"?</DialogTitle>
              <DialogDescription>
                This also deletes all {deletingColumn.links.length} link(s) inside it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingColumn(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteColumn.isPending}
                onClick={() =>
                  deleteColumn.mutate(deletingColumn.id, { onSuccess: () => setDeletingColumn(null) })
                }
              >
                {deleteColumn.isPending ? 'Deleting…' : 'Delete column'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function LinkRows({ column }: { column: FooterColumn }) {
  const reorderLinks = useReorderLinks(column.id);
  const deleteLink = useDeleteLink(column.id);

  const [editingLink, setEditingLink] = useState<FooterLink | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [deletingLink, setDeletingLink] = useState<FooterLink | null>(null);

  function moveLink(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= column.links.length) return;

    const reordered = [...column.links];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    reorderLinks.mutate({
      items: reordered.map((link, position) => ({ id: link.id, displayOrder: position })),
    });
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {column.links.map((link, index) => (
          <li key={link.id} className="group flex items-center justify-between gap-2 py-1.5 first:pt-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{link.label}</p>
              <p className="truncate text-xs text-muted-foreground">{link.href}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!link.isActive && (
                <Badge variant="secondary" className="mr-1 text-[10px]">
                  Inactive
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={index === 0 || reorderLinks.isPending}
                onClick={() => moveLink(index, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={index === column.links.length - 1 || reorderLinks.isPending}
                onClick={() => moveLink(index, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setEditingLink(link)}
                aria-label="Edit link"
              >
                <Pencil className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingLink(link)}
                aria-label="Delete link"
              >
                <Trash2 className="size-3 text-destructive" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setCreatingLink(true)}
      >
        <Plus className="size-3.5" aria-hidden />
        Add link
      </Button>

      {creatingLink && (
        <LinkFormDialog columnId={column.id} link={null} mode="create" onClose={() => setCreatingLink(false)} />
      )}
      {editingLink && (
        <LinkFormDialog
          columnId={column.id}
          link={editingLink}
          mode="edit"
          onClose={() => setEditingLink(null)}
        />
      )}

      {deletingLink && (
        <Dialog open onOpenChange={(open) => !open && setDeletingLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove "{deletingLink.label}"?</DialogTitle>
              <DialogDescription>It disappears from the footer immediately.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingLink(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteLink.isPending}
                onClick={() => deleteLink.mutate(deletingLink.id, { onSuccess: () => setDeletingLink(null) })}
              >
                {deleteLink.isPending ? 'Removing…' : 'Remove link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
