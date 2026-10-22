import { z } from 'zod';
import type { AddressInput } from './types';

const mobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

/** Same rules as the web's address-form schema, so both clients reject the same input. */
export const addressSchema = z
  .object({
    label: z.enum(['HOME', 'WORK', 'OTHER']),
    labelName: z.string().trim().max(40, 'Keep it under 40 characters').optional(),
    fullName: z.string().trim().min(2, 'Enter the receiver’s full name').max(120),
    phone: mobile,
    alternatePhone: z.union([z.literal(''), mobile]).optional(),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
    line1: z.string().trim().min(3, 'Add your flat / house no. and building').max(255),
    line2: z.string().trim().min(3, 'Add the area, street or locality').max(255),
    landmark: z.string().trim().max(160).optional(),
    city: z.string().trim().min(2, 'Enter the city / town').max(120),
    state: z.string().trim().min(2, 'Choose a state'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean(),
  })
  .refine((value) => value.label !== 'OTHER' || Boolean(value.labelName?.trim()), {
    path: ['labelName'],
    message: 'Name this address, e.g. “Mom’s place”',
  });

export type AddressFormValues = z.input<typeof addressSchema>;
export type AddressFormErrors = Partial<Record<keyof AddressFormValues, string>>;

export function validateAddress(values: AddressFormValues): { input?: AddressInput; errors: AddressFormErrors } {
  const result = addressSchema.safeParse(values);
  if (!result.success) {
    const errors: AddressFormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof AddressFormValues;
      errors[key] ??= issue.message;
    }
    return { errors };
  }
  const parsed = result.data;
  return {
    errors: {},
    input: {
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
    },
  };
}
