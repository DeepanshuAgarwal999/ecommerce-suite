import Link from 'next/link';
import { footerNav } from '@/config/nav';
import { siteConfig } from '@/config/site';
import { Logo } from './logo';

export function SiteFooter() {
  return (
    <footer className="bg-card mt-16 border-t pb-bottom-nav md:pb-0">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo size={24} />
          <p className="text-muted-foreground max-w-xs text-sm">
            {siteConfig.tagline}.
          </p>
        </div>

        {footerNav.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-xs font-extrabold tracking-[0.08em] uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-col gap-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-foreground/80 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="container text-muted-foreground flex flex-col gap-2 py-5 text-xs md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </span>
          <span>Prices in INR, inclusive of all taxes.</span>
        </div>
      </div>
    </footer>
  );
}
