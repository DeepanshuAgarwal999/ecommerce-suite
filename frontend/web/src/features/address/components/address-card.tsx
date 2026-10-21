'use client';

import { Briefcase, Home, MapPin, MoreVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { addressTitle, formatAddress, type Address, type AddressLabel } from '../types';

const ICON: Record<AddressLabel, typeof Home> = { HOME: Home, WORK: Briefcase, OTHER: MapPin };

interface AddressCardProps {
  address: Address;
  /** Checkout: the card is a radio option. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  className?: string;
}

/** One saved address: label chip, receiver, full address, phone, and its actions. */
export function AddressCard({
  address,
  selectable,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  className,
}: AddressCardProps) {
  const Icon = ICON[address.label];
  const hasMenu = Boolean(onEdit || onDelete || (onSetDefault && !address.isDefault));

  return (
    <div
      role={selectable ? 'radio' : undefined}
      aria-checked={selectable ? selected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        'bg-card relative flex gap-3 rounded-xl border p-4 transition-colors',
        selectable && 'hover:border-primary/40 cursor-pointer',
        selected && 'border-primary ring-primary/20 ring-2',
        className,
      )}
    >
      {selectable && (
        <span
          aria-hidden
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2',
            selected ? 'border-primary' : 'border-input',
          )}
        >
          {selected && <span className="bg-primary size-2.5 rounded-full" />}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase">
            <Icon className="size-3" aria-hidden />
            {addressTitle(address)}
          </span>
          {address.isDefault && (
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Star className="size-3 fill-current" aria-hidden />
              Default
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm font-bold">
          {address.fullName}
          <span className="text-muted-foreground ml-2 font-medium">+91 {address.phone}</span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{formatAddress(address)}</p>
      </div>

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-2 shrink-0"
              aria-label={`Options for ${addressTitle(address)} address`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            {onEdit && (
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
            )}
            {onSetDefault && !address.isDefault && (
              <DropdownMenuItem onSelect={onSetDefault}>
                <Star className="size-4" /> Make default
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
