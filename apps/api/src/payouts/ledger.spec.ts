import { nextPayoutRun } from './ledger.service.js';

describe('Payout cycle (PY-05)', () => {
  it('PY-05 the next run is the coming Monday at 06:00 IST', () => {
    // Friday 30 October 2026, 10:00 IST.
    expect(nextPayoutRun(new Date('2026-10-30T04:30:00Z')).toISOString()).toBe(
      '2026-11-02T00:30:00.000Z',
    );
    // Monday 2 November 2026, 07:00 IST: the following Monday.
    expect(nextPayoutRun(new Date('2026-11-02T01:30:00Z')).toISOString()).toBe(
      '2026-11-09T00:30:00.000Z',
    );
  });
});
