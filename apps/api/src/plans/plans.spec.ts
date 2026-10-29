import { proRataRefund } from './plans.service.js';

describe('Plan refunds (PK-07)', () => {
  it('PK-07 refunds the unused share and never more than paid', () => {
    expect(proRataRefund(100_000, 10, 3)).toBe(70_000);
    expect(proRataRefund(100_000, 10, 10)).toBe(0);
    expect(proRataRefund(100_000, 10, 12)).toBe(0);
    expect(proRataRefund(100_000, 0, 0)).toBe(0);
    expect(proRataRefund(99_999, 3, 1)).toBe(66_666);
  });
});
