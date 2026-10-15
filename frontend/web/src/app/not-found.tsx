import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={SearchX}
        title="We could not find that page"
        description="The link may be old, or the product may no longer be listed."
        action={
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        }
      />
    </div>
  );
}
