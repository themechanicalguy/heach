import { waitingDays, waitingTone } from './waiting';

describe('G17 waiting time in the queue', () => {
  const now = new Date('2026-11-04T10:00:00Z');

  it('counts whole days since submission, never negative, and nothing before submission', () => {
    expect(waitingDays('2026-11-04T09:00:00Z', now)).toBe(0);
    expect(waitingDays('2026-11-03T09:00:00Z', now)).toBe(1);
    expect(waitingDays('2026-10-25T10:00:00Z', now)).toBe(10);
    expect(waitingDays('2026-11-05T10:00:00Z', now)).toBe(0);
    expect(waitingDays(null, now)).toBeNull();
  });

  it('warms from two days and turns urgent at a week', () => {
    expect(waitingTone(1)).toBe('neutral');
    expect(waitingTone(2)).toBe('warning');
    expect(waitingTone(7)).toBe('danger');
    expect(waitingTone(null)).toBe('neutral');
  });
});
