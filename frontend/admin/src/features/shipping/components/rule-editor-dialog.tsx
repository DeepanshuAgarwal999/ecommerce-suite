'use client';

import { useState } from 'react';
import { Gift, Package, Truck } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeRule, toPaise, toRupees, type ChargeBasis, type EffectiveRule, type RuleInput, type ShippingMode, type ShippingRule, type ShippingSettings } from '../api';

const MODES: { value: ShippingMode; title: string; detail: string; icon: typeof Truck }[] = [
  { value: 'STANDARD', title: 'Standard', detail: 'Pays the store delivery fee, free above the threshold', icon: Truck },
  { value: 'FREE', title: 'Free delivery', detail: 'Never adds a delivery charge', icon: Gift },
  { value: 'FIXED', title: 'Own charge', detail: 'Bulky or special items with their own fee', icon: Package },
];

interface RuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What applies today without this rule ("inherits from Furniture: …"). */
  inherited: EffectiveRule | null;
  settings: ShippingSettings;
  current: ShippingRule | null;
  saving: boolean;
  onSave: (input: RuleInput) => void;
  onRemove?: () => void;
}

/**
 * Edit one category or product rule. Amounts are typed in rupees and stored in
 * paise; the summary line at the bottom reads back exactly what shoppers will get.
 */
export function RuleEditorDialog({ open, onOpenChange, title, inherited, settings, current, saving, onSave, onRemove }: RuleEditorDialogProps) {
  const [mode, setMode] = useState<ShippingMode>(current?.mode ?? 'FREE');
  const [fee, setFee] = useState(toRupees(current?.mode === 'FIXED' ? current.fee : null));
  const [basis, setBasis] = useState<ChargeBasis>(current?.chargeBasis ?? 'PER_UNIT');
  const [freeAbove, setFreeAbove] = useState(toRupees(current?.freeAbove));
  const [note, setNote] = useState(current?.note ?? '');

  const feePaise = toPaise(fee);
  const freeAbovePaise = toPaise(freeAbove);
  const invalid = mode === 'FIXED' && (!feePaise || feePaise <= 0 || Number.isNaN(feePaise) || (freeAbovePaise !== null && Number.isNaN(freeAbovePaise)));
  const preview = describeRule({ mode, fee: feePaise ?? 0, chargeBasis: basis, freeAbove: freeAbovePaise }, settings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery for {title}</DialogTitle>
          <DialogDescription>
            Without its own rule this {inherited?.source === 'CATEGORY' ? `inherits from ${inherited.sourceName}` : 'uses the store default'}:{' '}
            <span className="font-medium text-foreground">{describeRule(inherited, settings)}</span>
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Delivery type" className="grid gap-2 sm:grid-cols-3">
          {MODES.map(({ value, title: label, detail, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn('flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors', mode === value ? 'border-primary bg-primary/5' : 'hover:border-primary/40')}
            >
              <Icon className={cn('size-5', mode === value ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{detail}</span>
            </button>
          ))}
        </div>

        {mode === 'FIXED' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-fee">Delivery charge (₹)</Label>
              <Input id="rule-fee" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="499" />
            </div>
            <div className="space-y-1.5">
              <Label>Charged</Label>
              <div className="inline-flex w-full rounded-lg border p-0.5 text-sm">
                {(['PER_UNIT', 'PER_LINE'] as ChargeBasis[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBasis(value)}
                    className={cn('flex-1 rounded-md px-2 py-1.5', basis === value && 'bg-primary text-primary-foreground')}
                  >
                    {value === 'PER_UNIT' ? 'Per unit' : 'Once per line'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rule-free-above">Waive when the line total reaches (₹, optional)</Label>
              <Input id="rule-free-above" inputMode="decimal" value={freeAbove} onChange={(event) => setFreeAbove(event.target.value)} placeholder="e.g. 20000" />
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="rule-note">Internal note (optional)</Label>
          <Input id="rule-note" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Two-person delivery for sofas" />
        </div>

        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Shoppers will see: <span className="font-semibold">{preview}</span>
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          {current && onRemove ? (
            <Button variant="ghost" className="text-destructive" onClick={onRemove} disabled={saving}>
              Remove rule
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={invalid || saving}
            onClick={() =>
              onSave({
                mode,
                ...(mode === 'FIXED' ? { fee: feePaise ?? 0, chargeBasis: basis, freeAbove: freeAbovePaise } : {}),
                note: note.trim() || undefined,
              })
            }
          >
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
