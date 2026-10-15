import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { VendorGate } from '@/features/vendor/components/vendor-gate';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorGate>
      <div className="bg-background flex min-h-dvh flex-col">
        <header className="container flex h-16 items-center">
          <Link href="/" className="text-brand-dark font-heading text-xl font-extrabold">
            {siteConfig.name}
          </Link>
        </header>
        <main className="container flex flex-1 justify-center py-8">
          <div className="w-full max-w-2xl">{children}</div>
        </main>
      </div>
    </VendorGate>
  );
}
