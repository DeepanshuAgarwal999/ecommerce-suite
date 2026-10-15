import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Spinner className="text-primary size-6" />
    </div>
  );
}
