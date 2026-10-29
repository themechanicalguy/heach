import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Booking, BookingSummary } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { clearOfflineSummary, readOfflineSummary } from '../../lib/offline-summary';
import { BookAny, BookChosen } from './BookPages';
import { BookingDetailView, BookingsView } from './BookingsView';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push, refresh: state.refresh, replace: vi.fn() }),
  useSearchParams: () => state.params,
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: state.api,
}));

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );
const START = '2026-11-02T04:30:00.000Z';
const LISTING = '00000000-0000-4000-8000-000000000021';

const summary: BookingSummary = {
  id: '00000000-0000-4000-8000-000000000031',
  status: 'confirmed',
  cancelledBy: null,
  noShowParty: null,
  statusReason: null,
  service: 'nursing',
  itemCode: 'nursing_injection',
  itemName: 'Injection',
  kind: 'visit',
  matching: 'chosen',
  listingId: '00000000-0000-4000-8000-000000000021',
  startsAt: START,
  endsAt: START,
  shiftDays: 1,
  pin: '751001',
  provider: { id: 'p1', name: 'Synthetic Nurse' },
  recipientName: 'Synthetic Patient',
  fees: {
    feePaise: 30_000,
    travelPaise: 5_000,
    discountPaise: 0,
    totalPaise: 35_000,
    advancePaise: 35_000,
    paidPaise: 35_000,
    refundedPaise: 0,
    balanceDuePaise: 0,
  },
  acceptBy: null,
};
const booking = (overrides: Partial<Booking> = {}): Booking => ({
  ...summary,
  address: '12 Synthetic Lane',
  notes: null,
  events: [
    {
      fromStatus: 'pending_payment',
      toStatus: 'requested',
      reason: null,
      actorRole: 'system',
      createdAt: START,
    },
  ],
  refunds: [],
  canCancel: true,
  refundIfCancelledPaise: 17_500,
  checkout: null,
  hasPrescription: false,
  ...overrides,
});

function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    // Reads the test does not care about get an empty list; writes get no body.
    if (key) return Promise.resolve(responses[key]);
    return Promise.resolve(init?.method ? undefined : []);
  });
}

const bodyOf = (path: string) => {
  const call = (state.api.mock.calls as [string, RequestInit | undefined][]).find(
    ([called, init]) => called === path && init?.body,
  );
  return typeof call?.[1]?.body === 'string'
    ? (JSON.parse(call[1].body) as Record<string, unknown>)
    : undefined;
};

beforeEach(() => {
  state.api.mockReset();
  state.push.mockReset();
  state.params = new URLSearchParams(`provider=p1&start=${START}`);
  clearOfflineSummary();
});

describe('Booking a chosen provider (J3; BK-01, BK-04, BK-05, PY-01)', () => {
  it('BK-05 sends the details with the prescription, shows the fees and policy, then pays', async () => {
    const pending = booking({
      status: 'pending_payment',
      checkout: { orderId: 'order_1', amountPaise: 35_000, sandbox: true },
    });
    route({
      '/providers/p1': {
        id: 'p1',
        name: 'Synthetic Nurse',
        listings: [
          { listingId: LISTING, itemName: 'Injection', kind: 'visit', prescriptionRequired: true },
        ],
      },
      '/me/linked-patients': [{ id: 'lp1', fullName: 'Synthetic Child' }],
      '/booking-policy': {
        freeCancellationHours: 24,
        lateRefundPercent: 50,
        attendantAdvancePercent: 30,
        acceptanceWindowMinutes: 30,
      },
      '/bookings': pending,
      '/payments/sandbox': undefined,
    });
    inEnglish(<BookChosen listingId={LISTING} />);
    fireEvent.change(await screen.findByLabelText('Full address'), {
      target: { value: '12 Synthetic Lane' },
    });
    fireEvent.change(screen.getByLabelText('PIN code'), { target: { value: '751001' } });
    fireEvent.click(await screen.findByLabelText('Synthetic Child'));
    fireEvent.change(screen.getByLabelText("Doctor's prescription"), {
      target: { files: [new File(['%PDF'], 'rx.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByText('Check and pay')).toBeTruthy();
    expect(bodyOf('/bookings')).toMatchObject({
      listingId: LISTING,
      pin: '751001',
      recipientId: 'lp1',
      startsAt: START,
      prescription: { contentType: 'application/pdf' },
    });
    expect(
      await screen.findByText(/free until the provider accepts and up to 24 hours/),
    ).toBeTruthy();
    expect(screen.getByText('Test payment: no money moves.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Pay/ }));
    await waitFor(() => {
      expect(state.push).toHaveBeenCalledWith(`/en/bookings/${summary.id}?paid=1`);
    });
  });

  it('A10 any available: shows the quote and times, then the form with a gender choice', async () => {
    state.params = new URLSearchParams('pin=751001');
    route({
      '/search/any-slots': { slots: [START], quotePaise: 70_000, providers: 2 },
      '/me/linked-patients': [],
      '/catalogue': [
        {
          code: 'physio_neuro_rehab',
          name: 'Neuro rehabilitation session',
          kind: 'visit',
          prescriptionRequired: false,
        },
      ],
    });
    const view = inEnglish(<BookAny itemCode="physio_neuro_rehab" />);
    expect(await screen.findByText(/You pay up to ₹700.00/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Mon/ }).getAttribute('href')).toContain(
      '/en/book/any/physio_neuro_rehab?pin=751001&start=',
    );
    view.unmount();
    state.params = new URLSearchParams(`pin=751001&start=${START}`);
    inEnglish(<BookAny itemCode="physio_neuro_rehab" />);
    expect(await screen.findByText('Provider gender')).toBeTruthy();
  });
});

describe('My bookings (BK-04, BK-07)', () => {
  it('BK-07 lists bookings, keeps a summary offline, and shows it when the network fails', async () => {
    route({ '/bookings': [summary] });
    const view = inEnglish(<BookingsView />);
    expect(await screen.findByText('Injection')).toBeTruthy();
    await waitFor(() => {
      expect(readOfflineSummary()).toEqual([
        {
          id: summary.id,
          itemName: 'Injection',
          startsAt: START,
          providerName: 'Synthetic Nurse',
          status: 'confirmed',
        },
      ]);
    });
    expect(JSON.stringify(readOfflineSummary())).not.toContain('Synthetic Lane');
    view.unmount();
    state.api.mockRejectedValue(new TypeError('offline'));
    inEnglish(<BookingsView />);
    expect(await screen.findByText('You are offline. This is the last list we saw.')).toBeTruthy();
  });

  it('BK-04 shows the refund before cancelling, and cancels', async () => {
    route({ '/bookings/': booking() });
    inEnglish(<BookingDetailView bookingId={summary.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('If you cancel now, ₹175.00 is refunded.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    await waitFor(() => {
      expect(bodyOf(`/bookings/${summary.id}/cancel`)).toEqual({ reason: 'changed_plans' });
    });
  });

  it('Q-ADVANCE shows the balance due and pays it', async () => {
    const shift = booking({
      kind: 'shift',
      canCancel: false,
      fees: { ...summary.fees, totalPaise: 300_000, paidPaise: 90_000, balanceDuePaise: 210_000 },
      refunds: [{ amountPaise: 1_000, reason: 'goodwill', status: 'processed' }],
    });
    route({
      [`/bookings/${summary.id}/shifts`]: [],
      [`/bookings/${summary.id}/code`]: { code: '123456', moment: 'shift:0:in' },
      [`/bookings/${summary.id}/balance`]: {
        orderId: 'order_b',
        amountPaise: 210_000,
        sandbox: true,
      },
      '/bookings/': shift,
    });
    inEnglish(<BookingDetailView bookingId={summary.id} />);
    expect(await screen.findByText('Balance to pay: ₹2,100.00')).toBeTruthy();
    expect(screen.getByText('₹10.00: refunded')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay balance ₹2,100.00' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/payments/sandbox/order_b/pay', { method: 'POST' });
    });
  });
});
