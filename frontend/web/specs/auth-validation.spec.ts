import {
  COUNTRY_CODE,
  OTP_LENGTH,
  formatMobile,
  mobileSchema,
  otpSchema,
} from '../src/lib/validations/auth';
import { formatCountdown } from '../src/lib/hooks/use-countdown';

describe('mobileSchema', () => {
  it('accepts a 10-digit Indian number and strips separators', () => {
    expect(mobileSchema.parse('9876543210')).toBe('9876543210');
    expect(mobileSchema.parse('98765 43210')).toBe('9876543210');
    expect(mobileSchema.parse('98765-43210')).toBe('9876543210');
  });

  it('rejects wrong lengths', () => {
    expect(mobileSchema.safeParse('98765').success).toBe(false);
    expect(mobileSchema.safeParse('98765432101').success).toBe(false);
  });

  it('rejects numbers that do not start with 6-9', () => {
    for (const first of ['0', '1', '2', '3', '4', '5']) {
      expect(mobileSchema.safeParse(`${first}876543210`).success).toBe(false);
    }
  });

  it('rejects non-digits', () => {
    expect(mobileSchema.safeParse('98765abcde').success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts exactly the expected number of digits', () => {
    expect(otpSchema.safeParse('4'.repeat(OTP_LENGTH)).success).toBe(true);
  });

  it('rejects short, long and non-numeric codes', () => {
    expect(otpSchema.safeParse('123').success).toBe(false);
    expect(otpSchema.safeParse('1'.repeat(OTP_LENGTH + 1)).success).toBe(false);
    expect(otpSchema.safeParse('12a456').success).toBe(false);
  });
});

describe('formatMobile', () => {
  it('groups the number after the country code', () => {
    expect(formatMobile('9876543210')).toBe(`${COUNTRY_CODE} 98765 43210`);
  });
});

describe('formatCountdown', () => {
  it('renders m:ss and pads the seconds', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
