import { describe, expect, it } from 'vitest';
import { daysFromRules, rulesFromDays, toClock, toMinutes } from './hours';

describe('weekly hours (AV-01)', () => {
  it('AV-01 converts rules to day rows and back', () => {
    const days = daysFromRules([{ weekday: 1, startMinute: 540, endMinute: 1440 }]);
    expect(days[1]).toEqual({ open: true, from: '09:00', to: '24:00' });
    expect(days[0]?.open).toBe(false);
    expect(rulesFromDays(days)).toEqual([{ weekday: 1, startMinute: 540, endMinute: 1440 }]);
    expect(rulesFromDays([{ open: true, from: '20:00', to: '00:00' }])).toEqual([
      { weekday: 0, startMinute: 1200, endMinute: 1440 },
    ]);
    expect(toClock(75)).toBe('01:15');
    expect(toMinutes('10:30')).toBe(630);
  });
});
