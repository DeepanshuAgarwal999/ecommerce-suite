import { RotateCcw, ShieldCheck, Sparkles, Truck, type LucideIcon } from 'lucide-react';
import type { Usp } from '../data';

const icons: Record<Usp['id'], LucideIcon> = {
  delivery: Truck,
  returns: RotateCcw,
  payments: ShieldCheck,
  makers: Sparkles,
};

/** Four trust points under the hero. Collapses to a scrolling chip rail on phones. */
export function UspStrip({ usps }: { usps: Usp[] }) {
  return (
    <section aria-label="Why shop with us" className="container pt-3 md:pt-6">
      <ul className="rail md:bg-card md:grid md:grid-cols-4 md:gap-3 md:rounded-2xl md:px-6 md:py-[18px] md:shadow-[0_1px_3px_oklch(0.2_0.05_330/0.07)]">
        {usps.map((usp) => {
          const Icon = icons[usp.id] ?? Sparkles;
          return (
            <li
              key={usp.id}
              className="bg-card flex items-center gap-2 rounded-[10px] px-3 py-2 shadow-[0_1px_3px_oklch(0.2_0.05_330/0.07)] md:gap-3.5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
            >
              <span className="bg-secondary text-primary grid size-8 shrink-0 place-items-center rounded-lg md:size-11 md:rounded-xl">
                <Icon className="size-4 md:size-[22px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold whitespace-nowrap md:text-[14.5px] md:font-extrabold">
                  {usp.title}
                </div>
                <div className="text-muted-foreground hidden text-[13px] md:block">
                  {usp.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
