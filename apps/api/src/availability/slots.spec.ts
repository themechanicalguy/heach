import { generateSlots, isFree, isOfferedSlot, istDayStart, type SlotInput } from './slots.js';

// Friday 30 October 2026, 08:00 IST.
const NOW = new Date('2026-10-30T02:30:00Z');
const at = (ist: string) => new Date(`${ist}+05:30`);

const base = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  rules: [{ weekday: 5, startMinute: 600, endMinute: 720 }],
  busy: [],
  durationMinutes: 45,
  bufferMinutes: 15,
  now: NOW,
  days: 1,
  ...overrides,
});

describe('Slot generation in IST (AV-01 to AV-04)', () => {
  it('AV-04 day boundaries are IST midnights', () => {
    expect(istDayStart(NOW).toISOString()).toBe('2026-10-29T18:30:00.000Z');
    expect(istDayStart(new Date('2026-10-29T19:00:00Z')).toISOString()).toBe(
      '2026-10-29T18:30:00.000Z',
    );
    expect(istDayStart(NOW, 1).toISOString()).toBe('2026-10-30T18:30:00.000Z');
  });

  it('AV-02 visits start on a 30-minute grid and end inside the hours', () => {
    expect(generateSlots(base()).map((slot) => slot.toISOString())).toEqual([
      at('2026-10-30T10:00:00').toISOString(),
      at('2026-10-30T10:30:00').toISOString(),
      at('2026-10-30T11:00:00').toISOString(),
    ]);
  });

  it('AV-03 a booking plus buffers removes the slots that would touch it', () => {
    const busy = [{ start: at('2026-10-30T10:30:00'), end: at('2026-10-30T11:15:00') }];
    expect(generateSlots(base({ busy }))).toEqual([]);
    expect(generateSlots(base({ busy, bufferMinutes: 0 })).map((slot) => slot.getTime())).toEqual(
      [],
    );
    const later = [{ start: at('2026-10-30T11:45:00'), end: at('2026-10-30T12:00:00') }];
    expect(generateSlots(base({ busy: later, bufferMinutes: 0 }))).toHaveLength(3);
    expect(generateSlots(base({ busy: later }))).toHaveLength(2);
  });

  it('AV-01 leave removes a day; the lead time removes slots too soon', () => {
    const leave = [{ start: istDayStart(NOW), end: istDayStart(NOW, 1) }];
    expect(generateSlots(base({ busy: leave }))).toEqual([]);
    expect(generateSlots(base({ leadMinutes: 180 }))).toHaveLength(1);
    expect(isFree(at('2026-10-30T09:00:00'), base())).toBe(false);
  });

  it('SL-04 shifts start at their fixed time when the day is available', () => {
    const input = base({
      rules: [{ weekday: 6, startMinute: 0, endMinute: 1440 }],
      durationMinutes: 720,
      fixedStartMinute: 1200,
      days: 3,
    });
    expect(generateSlots(input).map((slot) => slot.toISOString())).toEqual([
      at('2026-10-31T20:00:00').toISOString(),
    ]);
  });

  it('AV-02 checks a requested time against the offered slots', () => {
    expect(isOfferedSlot(at('2026-10-30T10:30:00'), base())).toBe(true);
    expect(isOfferedSlot(at('2026-10-30T10:15:00'), base())).toBe(false);
    expect(isOfferedSlot(at('2026-10-20T10:30:00'), base())).toBe(false);
    expect(isOfferedSlot(at('2026-12-20T10:30:00'), base())).toBe(false);
  });
});
