import { describe, expect, it } from 'vitest';
import { dayPart, daysFrom, indiaDay, indiaNoon, slotsByDay } from './slots';

describe('G07 free times grouped by India day and part of the day', () => {
  it('uses the India calendar day, not UTC', () => {
    expect(indiaDay('2026-11-30T19:00:00Z')).toBe('2026-12-01');
    expect(indiaDay('2026-11-30T18:00:00Z')).toBe('2026-11-30');
    expect(indiaDay(indiaNoon('2026-12-01'))).toBe('2026-12-01');
  });

  it('splits morning, afternoon and evening at 12:00 and 17:00 India time', () => {
    expect(dayPart('2026-12-01T04:30:00Z')).toBe('morning'); // 10:00
    expect(dayPart('2026-12-01T06:30:00Z')).toBe('afternoon'); // 12:00
    expect(dayPart('2026-12-01T11:00:00Z')).toBe('afternoon'); // 16:30
    expect(dayPart('2026-12-01T11:30:00Z')).toBe('evening'); // 17:00
  });

  it('lists consecutive days across a month end', () => {
    expect(daysFrom('2026-11-29', 4)).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
  });

  it('groups and orders times per day', () => {
    const days = slotsByDay([
      '2026-12-01T11:30:00Z',
      '2026-12-01T04:30:00Z',
      '2026-12-02T04:30:00Z',
    ]);
    expect([...days.keys()]).toEqual(['2026-12-01', '2026-12-02']);
    expect(days.get('2026-12-01')).toEqual(['2026-12-01T04:30:00Z', '2026-12-01T11:30:00Z']);
  });
});
