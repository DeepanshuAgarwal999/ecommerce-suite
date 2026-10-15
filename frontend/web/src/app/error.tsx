'use client';

import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="Give it another go. If it keeps happening, our team has been notified."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
