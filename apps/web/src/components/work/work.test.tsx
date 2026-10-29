import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { EarningsView } from './EarningsView';
import { NotificationsView } from './NotificationsView';
import { RequestsView } from './RequestsView';
import { WorkView } from './WorkView';

const state = vi.hoisted(() => ({ api: vi.fn() }));
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

function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    // Reads the test does not care about get an empty list; writes get no body.
    if (key) return Promise.resolve(responses[key]);
    return Promise.resolve(init?.method ? undefined : []);
  });
}

beforeEach(() => {
  state.api.mockReset();
});

describe('Provider work (BK-03, HS-02, PY-04, NT-02)', () => {
  it('HS-01 A14 shows a request without the address, opens the prescription, accepts and declines', async () => {
    route({
      '/provider/requests/b1/prescription': {
        contentType: 'application/pdf',
        contentBase64: 'JVBERg==',
      },
      '/provider/requests': [
        {
          bookingId: 'b1',
          itemName: 'Injection',
          kind: 'visit',
          startsAt: START,
          endsAt: START,
          shiftDays: 1,
          pin: '751001',
          notes: 'Synthetic note',
          hasPrescription: true,
          earningPaise: 25_500,
          acceptBy: START,
        },
      ],
    });
    inEnglish(<RequestsView />);
    expect(await screen.findByText('You earn ₹255.00')).toBeTruthy();
    expect(screen.getByText("Patient's note: Synthetic note")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View prescription' }));
    expect(
      (await screen.findByRole('link', { name: 'View prescription' })).getAttribute('href'),
    ).toBe('data:application/pdf;base64,JVBERg==');
    fireEvent.change(screen.getByLabelText('Why are you declining?'), {
      target: { value: 'prescription_invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/provider/requests/b1/decline', {
        method: 'POST',
        body: '{"reason":"prescription_invalid"}',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/provider/requests/b1/accept', { method: 'POST' });
    });
  });

  it('HS-02 a confirmed booking shows address and contact, and can be cancelled', async () => {
    route({
      '/provider/bookings/b2': {
        id: 'b2',
        status: 'confirmed',
        address: '12 Synthetic Lane',
        contactMobile: '+919000000001',
        notes: null,
        earningPaise: 30_000,
        hasPrescription: false,
      },
      '/provider/bookings': [
        {
          id: 'b2',
          status: 'confirmed',
          itemName: 'Wound care',
          startsAt: START,
          recipientName: 'Synthetic Patient',
        },
      ],
    });
    inEnglish(<WorkView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
    expect(await screen.findByText('12 Synthetic Lane')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+919000000001' }).getAttribute('href')).toBe(
      'tel:+919000000001',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel this booking' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/provider/bookings/b2/cancel', {
        method: 'POST',
        body: '{"reason":"provider_unavailable"}',
      });
    });
  });
});

describe('Earnings and notifications (PY-04, NT-02)', () => {
  it('PY-04 shows the balance, the held part, payouts and ledger lines', async () => {
    route({
      '/provider/earnings': {
        balancePaise: 30_000,
        heldPaise: 10_000,
        paidOutPaise: 50_000,
        nextPayoutAt: START,
        lines: [
          {
            bookingId: 'b2',
            kind: 'earning',
            amountPaise: 30_000,
            availableAt: START,
            paidOut: false,
            createdAt: START,
          },
        ],
      },
    });
    inEnglish(<EarningsView />);
    expect(await screen.findByText('Not yet paid out: ₹300.00')).toBeTruthy();
    expect(screen.getByText(/Booking completed/)).toBeTruthy();
    expect(screen.getByText('Paid out so far: ₹500.00')).toBeTruthy();
  });

  it('NT-02 lists notifications in the reader language and marks them read', async () => {
    route({
      '/me/notifications': [
        {
          id: 'n1',
          template: 'booking_confirmed',
          params: { time: START },
          bookingId: 'b2',
          createdAt: START,
          readAt: null,
        },
      ],
    });
    inEnglish(<NotificationsView />);
    expect(await screen.findByText(/Your HEACH booking for .* is confirmed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/me/notifications/read', { method: 'POST' });
    });
  });
});
