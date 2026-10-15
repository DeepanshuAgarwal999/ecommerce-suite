import { createHash, randomBytes, randomInt } from 'node:crypto';

/** Ambiguous glyphs (0/O, 1/I/L) removed, so a code read aloud is unambiguous. */
const UNAMBIGUOUS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Combining diacritical marks, stripped after an NFKD normalise. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Human-facing order number, e.g. `ORD-4F2K9A-8213`.
 *
 * Deliberately not the primary key. Sequential ids leak order volume to competitors and
 * let anyone enumerate other people's orders; a random display id does neither, while
 * the database keeps a UUID for joins.
 */
export function generateOrderNumber(prefix = 'ORD'): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 6; i++) code += UNAMBIGUOUS[bytes[i] % UNAMBIGUOUS.length];
  return `${prefix}-${code}-${randomInt(1000, 9999)}`;
}

export function generateReferralCode(seed: string): string {
  const hash = createHash('sha256').update(seed).digest();
  let code = '';
  for (let i = 0; i < 8; i++) code += UNAMBIGUOUS[hash[i] % UNAMBIGUOUS.length];
  return code;
}

/**
 * Numeric OTP from a CSPRNG.
 *
 * `Math.random()` is not safe here - it is seeded predictably, so given a few observed
 * codes an attacker can predict the next one. `randomInt` draws from the OS entropy
 * pool instead.
 */
export function generateOtp(length = 6): string {
  let otp = '';
  for (let i = 0; i < length; i++) otp += randomInt(0, 10).toString();
  return otp;
}

export function generateSku(parts: {
  vendorCode: string;
  productCode: string;
  variantCode: string;
}): string {
  const clean = (part: string) => part.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return [clean(parts.vendorCode), clean(parts.productCode), clean(parts.variantCode)].join('-');
}

export function slugify(input: string, maxLength = 80): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

/** Appends a short random suffix so concurrent creates cannot collide on a slug. */
export function uniqueSlug(input: string): string {
  return `${slugify(input, 72)}-${randomBytes(3).toString('hex')}`;
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
