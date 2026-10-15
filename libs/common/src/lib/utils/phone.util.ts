import parsePhoneNumberFromString, { CountryCode } from 'libphonenumber-js';
import { AppException, ErrorCode } from '../errors/app-exception';
import { HttpStatus } from '@nestjs/common';

export interface NormalisedMobile {
  /** National number without the country code, e.g. `9876543210`. */
  mobile: string;
  /** Dialling code including the plus, e.g. `+91`. */
  countryCode: string;
  /** Full E.164 form, e.g. `+919876543210`. This is the stored identity key. */
  e164: string;
  country: string;
}

/**
 * Normalises a mobile number to E.164.
 *
 * Mobile is the primary identity in this system, so it has to be stored in exactly one
 * canonical form. Users type `9876543210`, `+91 98765 43210`, `09876543210` and
 * `091-9876543210` for the same number; without normalisation each of those becomes a
 * separate account and OTP rate limits are trivially bypassed.
 */
export function normaliseMobile(
  input: string,
  defaultRegion = 'IN',
): NormalisedMobile {
  const raw = (input ?? '').trim();
  if (!raw) {
    throw new AppException(
      ErrorCode.INVALID_MOBILE,
      'Mobile number is required',
      HttpStatus.BAD_REQUEST,
    );
  }

  const parsed = parsePhoneNumberFromString(raw, defaultRegion as CountryCode);

  if (!parsed || !parsed.isValid()) {
    throw new AppException(
      ErrorCode.INVALID_MOBILE,
      'Enter a valid mobile number',
      HttpStatus.BAD_REQUEST,
    );
  }

  // Landlines cannot receive an SMS OTP, so they are not a usable identity here.
  const type = parsed.getType();
  if (type && !['MOBILE', 'FIXED_LINE_OR_MOBILE'].includes(type)) {
    throw new AppException(
      ErrorCode.INVALID_MOBILE,
      'Enter a mobile number that can receive SMS',
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    mobile: parsed.nationalNumber.toString(),
    countryCode: `+${parsed.countryCallingCode}`,
    e164: parsed.number,
    country: parsed.country ?? defaultRegion,
  };
}

export function isValidMobile(input: string, defaultRegion = 'IN'): boolean {
  try {
    normaliseMobile(input, defaultRegion);
    return true;
  } catch {
    return false;
  }
}

/** `+919876543210` -> `+91 98765*****`. For log lines and support tooling. */
export function maskMobile(e164: string): string {
  if (e164.length < 6) return '*'.repeat(e164.length);
  return `${e164.slice(0, e164.length - 5)}${'*'.repeat(5)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '*'.repeat(email.length);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
