import { z } from 'zod';

/** Indian mobile: 10 digits, first digit 6-9. Spaces and dashes are stripped first. */
export const mobileSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^\d+$/, 'Digits only')
      .length(10, 'Enter a 10-digit mobile number')
      .regex(/^[6-9]/, 'Indian mobile numbers start with 6, 7, 8 or 9'),
  );

export const OTP_LENGTH = 6;

export const otpSchema = z
  .string()
  .length(OTP_LENGTH, `Enter the ${OTP_LENGTH}-digit code`)
  .regex(/^\d+$/, 'Digits only');

export const COUNTRY_CODE = '+91';

export function formatMobile(mobile: string, countryCode = COUNTRY_CODE): string {
  return `${countryCode} ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
}
