import {
  COUNTRY_CODE,
  OTP_LENGTH,
  formatMobile,
  mobileSchema,
  otpSchema,
} from '../src/lib/validations/auth';

describe('mobileSchema', () => {
  it('accepts a 10-digit Indian number and strips separators', () => {
    expect(mobileSchema.parse('9876543210')).toBe('9876543210');
    expect(mobileSchema.parse('98765 43210')).toBe('9876543210');
  });

  it('rejects numbers that do not start with 6-9', () => {
    expect(mobileSchema.safeParse('5876543210').success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts exactly OTP_LENGTH digits', () => {
    expect(otpSchema.safeParse('4'.repeat(OTP_LENGTH)).success).toBe(true);
    expect(otpSchema.safeParse('123').success).toBe(false);
  });
});

describe('formatMobile', () => {
  it('groups the number after the country code', () => {
    expect(formatMobile('9876543210')).toBe(`${COUNTRY_CODE} 98765 43210`);
  });
});
