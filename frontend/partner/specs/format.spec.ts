import { formatPrice, titleCaseStatus, initials } from '../src/lib/utils/format';

describe('formatPrice', () => {
  it('formats paise as whole rupees with Indian grouping', () => {
    expect(formatPrice(119_900)).toBe('₹1,199');
    expect(formatPrice(12_345_600)).toBe('₹1,23,456');
  });
});

describe('titleCaseStatus', () => {
  it('turns an ENUM_LIKE status into a readable sentence fragment', () => {
    expect(titleCaseStatus('PENDING_REVIEW')).toBe('Pending review');
    expect(titleCaseStatus('APPROVED')).toBe('Approved');
  });
});

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Sundara Home Studio')).toBe('SH');
    expect(initials('Acme')).toBe('A');
  });
});
