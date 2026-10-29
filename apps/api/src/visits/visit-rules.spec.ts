import {
  noShowSplit,
  patientNoShowAllowed,
  providerNoShowAllowed,
  shiftShare,
  startWindowOpen,
} from './visit-rules.js';

const start = new Date('2026-11-02T04:30:00Z');
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

describe('Visit rules (HS-03, HS-05, A12, A15)', () => {
  it('HS-03 the start code works only around the slot', () => {
    expect(startWindowOpen(start, at(-31))).toBe(false);
    expect(startWindowOpen(start, at(-30))).toBe(true);
    expect(startWindowOpen(start, at(180))).toBe(true);
    expect(startWindowOpen(start, at(181))).toBe(false);
  });

  it('A15 A12 absence can be reported only after the wait', () => {
    expect(patientNoShowAllowed(start, at(14), 15)).toBe(false);
    expect(patientNoShowAllowed(start, at(15), 15)).toBe(true);
    expect(providerNoShowAllowed(start, at(29))).toBe(false);
    expect(providerNoShowAllowed(start, at(30))).toBe(true);
  });

  it('PK-07 shift shares add up to the earning', () => {
    const shares = [0, 1, 2].map((day) => shiftShare(100_000, 3, day));
    expect(shares).toEqual([33_333, 33_333, 33_334]);
  });

  it('A15 a patient no-show keeps half for the provider, less commission', () => {
    expect(noShowSplit(60_000, 50, 1500)).toEqual({ refundPaise: 30_000, providerPaise: 25_500 });
  });
});
