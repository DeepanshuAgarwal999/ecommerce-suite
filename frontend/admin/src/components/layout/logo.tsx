import { cn } from 'cn';

/** Simple wordmark + glyph — this console has no separate brand identity from the platform. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-sm font-semibold tracking-tight">Ops Console</span>
    </div>
  );
}
