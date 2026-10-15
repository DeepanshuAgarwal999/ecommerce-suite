import Link from 'next/link';
import { siteConfig } from '@/config/site';

/** No nav — a seller arriving here has nothing else to do but sign in. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="container flex h-16 items-center">
        <Link href="/" className="text-brand-dark font-heading text-xl font-extrabold">
          {siteConfig.name}
        </Link>
      </header>
      <main className="container flex flex-1 items-start justify-center py-8 sm:items-center">
        <div className="bg-card w-full max-w-md rounded-2xl border p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
