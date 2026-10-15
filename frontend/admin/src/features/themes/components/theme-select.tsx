'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThemes } from '../hooks/use-themes';

const ALWAYS = '__always__';

/** "Show during: Always | Diwali 2026 | Holi 2027" - for banners and home sections. */
export function ThemeSelect({ value, onChange }: { value: string | null; onChange: (themeId: string | null) => void }) {
  const { data: themes } = useThemes();

  return (
    <Select value={value ?? ALWAYS} onValueChange={(next) => onChange(next === ALWAYS ? null : next)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALWAYS}>Always (every theme)</SelectItem>
        {themes?.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            Only during {theme.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
