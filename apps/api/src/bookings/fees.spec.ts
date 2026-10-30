import { cancellationRefund, feeBreakdown, providerEarning } from './fees.js';

const policy = { freeCancellationHours: 24, lateRefundPercent: 50 };
const startsAt = new Date('2026-11-02T04:30:00Z');

describe('Fees and refunds (BK-01, BK-04, PY-01, PY-02, Q-COMMISSION, Q-ADVANCE)', () => {
  it('PY-01 a visit is paid in full; commission is on the fee only', () => {
    expect(
      feeBreakdown({
        unitFeePaise: 60_000,
        travelPaise: 5_000,
        units: 1,
        commissionBps: 1500,
        advancePercent: 100,
      }),
    ).toEqual({
      feePaise: 60_000,
      travelPaise: 5_000,
      discountPaise: 0,
      totalPaise: 65_000,
      commissionPaise: 9_000,
      advancePaise: 65_000,
    });
  });

  it('Q-ADVANCE a 3-day attendant booking pays 30 % up front', () => {
    const fees = feeBreakdown({
      unitFeePaise: 90_000,
      travelPaise: 0,
      units: 3,
      commissionBps: 1500,
      advancePercent: 30,
    });
    expect(fees).toMatchObject({
      feePaise: 270_000,
      totalPaise: 270_000,
      advancePaise: 81_000,
      commissionPaise: 40_500,
    });
    expect(providerEarning(fees)).toBe(229_500);
  });

  it('BK-04 patients get everything back early and the late share after the free window', () => {
    const base = {
      status: 'confirmed' as const,
      by: 'patient' as const,
      paidPaise: 10_000,
      startsAt,
      policy,
    };
    expect(cancellationRefund({ ...base, now: new Date('2026-10-31T04:30:00Z') })).toBe(10_000);
    expect(cancellationRefund({ ...base, now: new Date('2026-11-01T10:30:00Z') })).toBe(5_000);
    expect(
      cancellationRefund({ ...base, status: 'requested', now: new Date('2026-11-02T04:00:00Z') }),
    ).toBe(10_000);
    expect(
      cancellationRefund({ ...base, by: 'provider', now: new Date('2026-11-02T04:00:00Z') }),
    ).toBe(10_000);
  });

  it('FU-39 once shifts have begun, only the shifts not worked come back, never more than paid', () => {
    const base = {
      status: 'in_progress' as const,
      by: 'admin' as const,
      startsAt,
      now: new Date('2026-11-02T10:00:00Z'),
      policy,
      shifts: { totalPaise: 300_000, worked: 1, count: 3 },
    };
    expect(cancellationRefund({ ...base, paidPaise: 300_000 })).toBe(200_000);
    expect(cancellationRefund({ ...base, by: 'patient', paidPaise: 300_000 })).toBe(200_000);
    expect(cancellationRefund({ ...base, paidPaise: 90_000 })).toBe(0);
    expect(
      cancellationRefund({ ...base, paidPaise: 300_000, shifts: { ...base.shifts, worked: 0 } }),
    ).toBe(300_000);
  });
});
