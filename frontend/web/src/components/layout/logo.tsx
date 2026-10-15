import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Wordmark size in px; the mark scales with it. */
  size?: number;
}

/** Placeholder mark + wordmark from the design canvas. Swap for the real brand asset. */
export function Logo({ className, size = 26 }: LogoProps) {
  const mark = Math.round(size * 1.08);

  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} home`}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="text-primary"
      >
        <path
          d="M4 12.5 14 4l10 8.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 11.5V23h15V11.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="17" r="3" className="fill-highlight" />
      </svg>
      <span
        className="font-heading text-brand-dark font-extrabold tracking-tight"
        style={{ fontSize: size, lineHeight: 1 }}
      >
        {siteConfig.name}
      </span>
    </Link>
  );
}
