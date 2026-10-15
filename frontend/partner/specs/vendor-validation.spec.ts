import { applyVendorSchema } from '../src/lib/validations/vendor';

describe('applyVendorSchema', () => {
  it('requires only a business name', () => {
    const result = applyVendorSchema.safeParse({ businessName: 'Sundara Home Studio' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid GSTIN but accepts a valid one', () => {
    expect(
      applyVendorSchema.safeParse({ businessName: 'Acme', gstin: 'not-a-gstin' }).success,
    ).toBe(false);
    expect(
      applyVendorSchema.safeParse({ businessName: 'Acme', gstin: '29ABCDE1234F1Z5' }).success,
    ).toBe(true);
  });

  it('rejects an invalid PAN but accepts a valid one', () => {
    expect(applyVendorSchema.safeParse({ businessName: 'Acme', pan: '12345' }).success).toBe(
      false,
    );
    expect(
      applyVendorSchema.safeParse({ businessName: 'Acme', pan: 'ABCDE1234F' }).success,
    ).toBe(true);
  });
});
