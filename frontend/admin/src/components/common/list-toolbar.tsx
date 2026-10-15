'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {children}
    </div>
  );
}
