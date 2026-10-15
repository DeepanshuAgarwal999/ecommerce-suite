import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  href,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-primary inline-flex shrink-0 items-center text-sm font-medium hover:underline"
        >
          See all
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
