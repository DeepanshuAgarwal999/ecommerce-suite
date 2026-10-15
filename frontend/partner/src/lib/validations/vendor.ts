import { z } from 'zod';

/** Matches the gstin pattern class-validator enforces in ApplyVendorDto. */
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const applyVendorSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name').max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinPattern, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(panPattern, 'Enter a valid 10-character PAN')
    .optional()
    .or(z.literal('')),
  fssaiLicense: z.string().trim().max(20).optional().or(z.literal('')),
  supportEmail: z.email('Enter a valid email').optional().or(z.literal('')),
  supportPhone: z.string().trim().max(20).optional().or(z.literal('')),
});

export type ApplyVendorFormValues = z.infer<typeof applyVendorSchema>;
