import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from 'cn';

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  isLoading?: boolean;
  tone?: 'default' | 'warning' | 'destructive';
}

export function KpiCard({ label, value, icon: Icon, href, isLoading, tone = 'default' }: KpiCardProps) {
  const body = (
    <Card className={cn('transition-colors', href && 'hover:border-primary/40')}>
      <CardContent className="flex items-center gap-4 py-1">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'warning' && 'bg-status-warning/15 text-status-warning',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            tone === 'default' && 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
