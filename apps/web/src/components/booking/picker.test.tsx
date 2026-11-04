import { CATALOGUES } from '@heach/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n-context';
import { BookingReceipt } from './BookingReceipt';
import { DayTimePicker } from './DayTimePicker';

const policy = vi.hoisted(() => ({ data: {} }));
vi.mock('../../lib/use-resource', () => ({
  useResource: () => ({ resource: { state: 'ready', data: policy.data }, reload: vi.fn() }),
}));
afterEach(cleanup);

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

// India times on Wednesday 2 and Thursday 3 December 2099; nothing on Friday 4.
const SLOTS = [
  '2099-12-02T04:00:00Z', // 09:30
  '2099-12-02T09:30:00Z', // 15:00
  '2099-12-02T13:00:00Z', // 18:30
  '2099-12-03T04:30:00Z', // 10:00 next day
];

it('G07 groups the chosen day into morning, afternoon and evening, selecting one time', () => {
  const onSelect = vi.fn();
  inEnglish(<DayTimePicker slots={SLOTS} selected="" onSelect={onSelect} horizon={7} />);
  const parts = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
  expect(parts).toEqual(['Morning', 'Afternoon', 'Evening']);
  fireEvent.click(screen.getByRole('button', { name: /2 Dec, 3:00/ }));
  expect(onSelect).toHaveBeenCalledWith('2099-12-02T09:30:00Z');
});

it('G07 marks the selected time, switches days, and disables days without free times', () => {
  inEnglish(
    <DayTimePicker slots={SLOTS} selected={SLOTS[3] ?? ''} onSelect={vi.fn()} horizon={7} />,
  );
  const days = within(screen.getByRole('list', { name: 'December 2099' })).getAllByRole('button');
  expect(days).toHaveLength(7);
  expect(days[1]?.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: /3 Dec, 10:00/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect((days[2] as HTMLButtonElement).disabled).toBe(true);
  expect(days[2]?.textContent).toContain('no free times');
  fireEvent.click(days[0] as HTMLButtonElement);
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Later days' })).toBeNull();
});

it('G07 pages through a fortnight a week at a time', () => {
  inEnglish(<DayTimePicker slots={SLOTS} selected="" onSelect={vi.fn()} horizon={14} />);
  const earlier = screen.getByRole<HTMLButtonElement>('button', { name: 'Earlier days' });
  const later = screen.getByRole<HTMLButtonElement>('button', { name: 'Later days' });
  expect(earlier.disabled).toBe(true);
  fireEvent.click(later);
  expect(later.disabled).toBe(true);
  expect(earlier.disabled).toBe(false);
});

it('G09 the receipt shows the listed fee and policy, never a total of its own', () => {
  policy.data = { freeCancellationHours: 24, lateRefundPercent: 50 };
  inEnglish(
    <BookingReceipt
      providerName="Synthetic Physio"
      itemName="Physiotherapy at home"
      startsAt=""
      feePaise={60_000}
    />,
  );
  const receipt = screen.getByRole('complementary', { name: 'Your booking' });
  expect(receipt.textContent).toContain('Synthetic Physio');
  expect(receipt.textContent).toContain('Choose a day and time');
  expect(receipt.textContent).toContain('₹600.00');
  expect(receipt.textContent).not.toContain('Total');
  expect(receipt.textContent).toContain(CATALOGUES.en.book.totalNext);
  expect(receipt.textContent).toMatch(/up to 24 hours before the start/);
});

it('G09 states no cancellation policy until the server has given its numbers', () => {
  policy.data = [];
  inEnglish(<BookingReceipt itemName="Physiotherapy at home" startsAt="" />);
  expect(screen.queryByText(/Cancellation/)).toBeNull();
});
