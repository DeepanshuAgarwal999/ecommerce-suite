'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Briefcase, Home, MapPin } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/features/auth/hooks/use-session';
import { queryKeys } from '@/lib/api';
import { cn } from '@/lib/utils';
import { mobileSchema } from '@/lib/validations/auth';
import { addressApi } from '../api/address-api';
import { useSaveAddress } from '../hooks/use-addresses';
import { INDIAN_STATES, matchState } from '../indian-states';
import { LABELS, type Address, type AddressInput, type AddressLabel, type ReverseGeocode } from '../types';
import { LocationPicker } from './location-picker';

const schema = z
  .object({
    label: z.enum(['HOME', 'WORK', 'OTHER']),
    labelName: z.string().trim().max(40, 'Keep it under 40 characters').optional(),
    fullName: z.string().trim().min(2, 'Enter the receiver’s full name').max(120),
    phone: mobileSchema,
    alternatePhone: z.union([z.literal(''), mobileSchema]).optional(),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
    line1: z.string().trim().min(3, 'Add your flat / house no. and building').max(255),
    line2: z.string().trim().min(3, 'Add the area, street or locality').max(255),
    landmark: z.string().trim().max(160).optional(),
    city: z.string().trim().min(2, 'Enter the city / town').max(120),
    state: z.string().trim().min(2, 'Choose a state'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean(),
  });

type FormValues = z.input<typeof schema>;

const LABEL_ICON: Record<AddressLabel, typeof Home> = { HOME: Home, WORK: Briefcase, OTHER: MapPin };

interface AddressFormProps {
  /** Editing an existing address; omit to add a new one. */
  address?: Address | null;
  submitLabel?: string;
  onSaved?: (address: Address) => void;
  onCancel?: () => void;
  /** Hides "make default" - e.g. for the very first address, which is always default. */
  hideDefaultToggle?: boolean;
}

function lastTen(mobile?: string | null): string {
  return (mobile ?? '').replace(/\D/g, '').slice(-10);
}

/**
 * Add / edit a delivery address - the Flipkart/Meesho form:
 *  1. optional "Use my current location" / map pin, which fills area, city, state
 *     and pincode (the shopper adds flat/house no.);
 *  2. pincode autofills city and state, and offers its localities as one-tap chips;
 *  3. Home / Work / Other (with a custom name like "Mom's place");
 *  4. receiver name and phone, prefilled with the account's number.
 * Everything can be typed by hand; location is a shortcut, never a requirement.
 */
export function AddressForm({ address, submitLabel, onSaved, onCancel, hideDefaultToggle }: AddressFormProps) {
  const { user } = useSession();
  const save = useSaveAddress();
  const line1Ref = useRef<HTMLInputElement | null>(null);
  // Fields filled by a lookup (not typed) may be overwritten by the next lookup.
  const autofilled = useRef<{ city: boolean; state: boolean }>({ city: !address, state: !address });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      label: address?.label ?? 'HOME',
      labelName: address?.labelName ?? '',
      fullName: address?.fullName ?? '',
      phone: address?.phone ?? lastTen(user?.mobile),
      alternatePhone: address?.alternatePhone ?? '',
      pincode: address?.pincode ?? '',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      landmark: address?.landmark ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      latitude: address?.latitude ?? undefined,
      longitude: address?.longitude ?? undefined,
      isDefault: address?.isDefault ?? false,
    },
  });
  const { register, handleSubmit, setValue, control, formState } = form;
  const errors = formState.errors;
  const [label, pincode, line2, stateValue, isDefault] = useWatch({
    control,
    name: ['label', 'pincode', 'line2', 'state', 'isDefault'],
  });

  // Pincode -> city / state / locality suggestions.
  const validPin = /^[1-9]\d{5}$/.test(pincode ?? '') ? (pincode as string) : null;
  const pinInfo = useQuery({
    queryKey: queryKeys.geo.pincode(validPin ?? ''),
    queryFn: () => addressApi.pincode(validPin as string),
    enabled: Boolean(validPin),
    retry: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    const info = pinInfo.data;
    if (!info) return;
    const current = form.getValues();
    if (autofilled.current.city || !current.city) {
      setValue('city', info.city, { shouldValidate: true });
      autofilled.current.city = true;
    }
    if (autofilled.current.state || !current.state) {
      setValue('state', matchState(info.state), { shouldValidate: true });
      autofilled.current.state = true;
    }
  }, [pinInfo.data, form, setValue]);

  function applyLocation(place: ReverseGeocode) {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    const current = form.getValues();
    if (place.line2) setValue('line2', place.line2, opts);
    if (place.city) setValue('city', place.city, opts);
    if (place.state) setValue('state', matchState(place.state), opts);
    if (place.pincode) setValue('pincode', place.pincode, opts);
    // The map rarely knows the flat number - keep what they typed, else suggest the building.
    if (!current.line1 && place.line1) setValue('line1', place.line1, opts);
    setValue('latitude', place.latitude);
    setValue('longitude', place.longitude);
    autofilled.current = { city: true, state: true };
    // Next thing they must add: flat / house number.
    requestAnimationFrame(() => line1Ref.current?.focus());
  }

  async function onSubmit(values: FormValues) {
    const parsed = schema.parse(values);
    const input: AddressInput = {
      label: parsed.label,
      labelName: parsed.label === 'OTHER' ? parsed.labelName || undefined : undefined,
      fullName: parsed.fullName,
      phone: parsed.phone,
      alternatePhone: parsed.alternatePhone || '',
      line1: parsed.line1,
      line2: parsed.line2,
      landmark: parsed.landmark || '',
      city: parsed.city,
      state: parsed.state,
      pincode: parsed.pincode,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      isDefault: parsed.isDefault,
    };
    const saved = await save.mutateAsync({ id: address?.id, input });
    onSaved?.(saved);
  }

  const line1Field = register('line1');
  const fieldError = (message?: string) =>
    message ? <p className="text-destructive mt-1 text-xs">{message}</p> : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">Location</h3>
        <LocationPicker
          initial={address?.latitude != null && address.longitude != null ? { lat: address.latitude, lng: address.longitude } : null}
          onConfirm={applyLocation}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">Address</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="6-digit pincode"
              className="mt-1.5"
              {...register('pincode', {
                onChange: (event) => {
                  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
                },
              })}
            />
            {fieldError(errors.pincode?.message)}
            {validPin && pinInfo.isError && (
              <p className="text-muted-foreground mt-1 text-xs">We couldn’t verify this pincode - double-check it.</p>
            )}
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select
              value={stateValue || undefined}
              onValueChange={(value) => {
                autofilled.current.state = false;
                setValue('state', value, { shouldValidate: true, shouldDirty: true });
              }}
            >
              <SelectTrigger id="state" className="mt-1.5 w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError(errors.state?.message)}
          </div>
        </div>

        <div>
          <Label htmlFor="line1">House no., building, apartment</Label>
          <Input
            id="line1"
            autoComplete="address-line1"
            placeholder="Flat 12B, Lotus Residency"
            className="mt-1.5"
            {...line1Field}
            ref={(element) => {
              line1Field.ref(element);
              line1Ref.current = element;
            }}
          />
          {fieldError(errors.line1?.message)}
        </div>

        <div>
          <Label htmlFor="line2">Area, street, sector, village</Label>
          <Input id="line2" autoComplete="address-line2" placeholder="Indiranagar 2nd Stage" className="mt-1.5" {...register('line2')} />
          {fieldError(errors.line2?.message)}
          {pinInfo.data && pinInfo.data.areas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pinInfo.data.areas.slice(0, 8).map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setValue('line2', area, { shouldValidate: true, shouldDirty: true })}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    line2 === area ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40',
                  )}
                >
                  {area}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">City / Town</Label>
            <Input
              id="city"
              autoComplete="address-level2"
              className="mt-1.5"
              {...register('city', { onChange: () => (autofilled.current.city = false) })}
            />
            {fieldError(errors.city?.message)}
          </div>
          <div>
            <Label htmlFor="landmark">
              Landmark <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="landmark" placeholder="Near City Hospital" className="mt-1.5" {...register('landmark')} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">Contact details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Receiver’s full name</Label>
            <Input id="fullName" autoComplete="name" className="mt-1.5" {...register('fullName')} />
            {fieldError(errors.fullName?.message)}
          </div>
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <div className="mt-1.5 flex">
              <span className="bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-2.5 text-sm">+91</span>
              <Input id="phone" inputMode="tel" autoComplete="tel-national" maxLength={10} className="rounded-l-none" {...register('phone')} />
            </div>
            {fieldError(errors.phone?.message)}
          </div>
        </div>
        <div className="sm:w-1/2 sm:pr-1.5">
          <Label htmlFor="alternatePhone">
            Alternate number <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="alternatePhone" inputMode="tel" maxLength={10} className="mt-1.5" {...register('alternatePhone')} />
          {fieldError(errors.alternatePhone?.message)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">Save address as</h3>
        <div role="radiogroup" aria-label="Address type" className="flex flex-wrap gap-2">
          {LABELS.map((option) => {
            const Icon = LABEL_ICON[option.value];
            const selected = label === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setValue('label', option.value, { shouldDirty: true })}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
                  selected ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        {label === 'OTHER' && (
          <div className="sm:w-1/2">
            <Label htmlFor="labelName">Name this address</Label>
            <Input id="labelName" placeholder="e.g. Mom’s place, Gym" maxLength={40} className="mt-1.5" {...register('labelName')} />
            {fieldError(errors.labelName?.message)}
          </div>
        )}
        {!hideDefaultToggle && (
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setValue('isDefault', checked === true, { shouldDirty: true })}
            />
            Make this my default address
          </label>
        )}
      </section>

      <div className="bg-background sticky bottom-0 -mx-1 flex gap-2 px-1 pt-2 pb-1">
        {onCancel && (
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="h-12 flex-1 text-[15px] font-bold" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : (submitLabel ?? (address ? 'Save changes' : 'Save address'))}
        </Button>
      </div>
    </form>
  );
}
