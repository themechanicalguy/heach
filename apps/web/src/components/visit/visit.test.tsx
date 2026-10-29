import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Booking, ProviderBooking } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { AccessSection, TicketsSection } from '../work/SupportSections';
import { PatientVisitPanel } from './PatientVisitPanel';
import { ProviderVisitPanel } from './ProviderVisitPanel';

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
const ID = 'b1';

const base = {
  id: ID,
  cancelledBy: null,
  noShowParty: null,
  statusReason: null,
  service: 'nursing',
  itemCode: 'nursing_wound_dressing',
  itemName: 'Wound care',
  kind: 'visit' as const,
  matching: 'chosen' as const,
  listingId: 'l1',
  startsAt: START,
  endsAt: START,
  shiftDays: 1,
  pin: '751001',
  provider: { id: 'p1', name: 'Synthetic Nurse' },
  recipientName: 'Synthetic Patient',
  fees: {
    feePaise: 1,
    travelPaise: 0,
    discountPaise: 0,
    totalPaise: 1,
    advancePaise: 1,
    paidPaise: 1,
    refundedPaise: 0,
    balanceDuePaise: 0,
  },
  acceptBy: null,
  hasPrescription: false,
  notes: null,
};
const patientBooking = (status: Booking['status'], kind: Booking['kind'] = 'visit'): Booking => ({
  ...base,
  kind,
  status,
  address: '12 Synthetic Lane',
  events: [],
  refunds: [],
  canCancel: false,
  refundIfCancelledPaise: 0,
  checkout: null,
});
const providerBooking = (
  status: ProviderBooking['status'],
  kind: ProviderBooking['kind'] = 'visit',
): ProviderBooking => ({
  ...base,
  kind,
  status,
  address: '12 Synthetic Lane',
  contactMobile: '+919000000001',
  earningPaise: 1,
});

function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    if (key) return Promise.resolve(responses[key]);
    return Promise.resolve(init?.method ? undefined : []);
  });
}
const posted = (path: string) =>
  (state.api.mock.calls as [string, RequestInit | undefined][]).find(
    ([called, init]) => called === path && init?.method === 'POST',
  );
const onChanged = vi.fn(() => Promise.resolve());

beforeEach(() => {
  state.api.mockReset();
  onChanged.mockClear();
});

describe('The patient side of a visit (HS-03, HS-06, RF-01, A12, BK-09)', () => {
  it('HS-03 shows the start code; A12 reports an absent provider; HS-06 sends a safety concern', async () => {
    route({ [`/bookings/${ID}/code`]: { code: '482913', moment: 'visit' } });
    inEnglish(<PatientVisitPanel booking={patientBooking('confirmed')} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show start code' }));
    expect(await screen.findByText('Your code: 482913')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'The provider has not arrived' }));
    await waitFor(() => {
      expect(posted(`/bookings/${ID}/provider-no-show`)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report a safety concern' }));
    expect(screen.getByText(/call 108 now/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tell us more (optional)'), {
      target: { value: 'Synthetic' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Our team will contact you/)).toBeTruthy();
    expect(JSON.parse(posted('/tickets')?.[1]?.body as string)).toEqual({
      bookingId: ID,
      kind: 'safety',
      topic: 'safety_threat',
      description: 'Synthetic',
    });
  });

  it('HS-04 RF-01 BK-09 a completed visit shows its notes, a rating form and book again', async () => {
    route({
      [`/bookings/${ID}/visit-notes`]: {
        procedure: 'Dressing',
        observations: 'Healing',
        advice: 'Rest',
        completedAt: START,
      },
    });
    inEnglish(<PatientVisitPanel booking={patientBooking('completed')} onChanged={onChanged} />);
    expect(await screen.findByText('Healing')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Book again' }).getAttribute('href')).toBe(
      '/en/providers/p1?listing=l1',
    );
    fireEvent.change(screen.getByLabelText('Stars (1 to 5)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send rating' }));
    expect(await screen.findByText('Thank you for your rating.')).toBeTruthy();
  });

  it('HS-05 lists the shifts of an attendant booking', async () => {
    route({
      [`/bookings/${ID}/shifts`]: [
        {
          dayIndex: 0,
          startsAt: START,
          endsAt: START,
          status: 'checked_in',
          checkedInAt: START,
          checkedOutAt: null,
        },
      ],
    });
    inEnglish(
      <PatientVisitPanel booking={patientBooking('in_progress', 'shift')} onChanged={onChanged} />,
    );
    expect(await screen.findByText(/Day 1: Checked in/)).toBeTruthy();
  });
});

describe('The provider side of a visit (HS-02 to HS-05, A15)', () => {
  it('HS-03 starts a visit with the code; HS-02 links the map; A15 marks the patient absent', async () => {
    route({ '/booking-policy': { noShowWaitMinutes: 15 } });
    inEnglish(<ProviderVisitPanel booking={providerBooking('confirmed')} onChanged={onChanged} />);
    expect(screen.getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toContain(
      '12%20Synthetic%20Lane',
    );
    fireEvent.change(screen.getByLabelText("Patient's code"), { target: { value: '482913' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start visit' }));
    await waitFor(() => {
      expect(JSON.parse(posted(`/provider/bookings/${ID}/start`)?.[1]?.body as string)).toEqual({
        code: '482913',
      });
    });
    expect(await screen.findByText(/Wait 15 minutes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Patient not here' }));
    await waitFor(() => {
      expect(posted(`/provider/bookings/${ID}/no-show`)).toBeTruthy();
    });
  });

  it('HS-04 completes a visit with notes', async () => {
    route({});
    inEnglish(
      <ProviderVisitPanel booking={providerBooking('in_progress')} onChanged={onChanged} />,
    );
    for (const [label, value] of [
      ['What was done', 'Dressing'],
      ['What was seen', 'Healing'],
      ['Advice and next visit', 'Rest'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    await waitFor(() => {
      expect(JSON.parse(posted(`/provider/bookings/${ID}/complete`)?.[1]?.body as string)).toEqual({
        procedure: 'Dressing',
        observations: 'Healing',
        advice: 'Rest',
      });
    });
  });

  it('HS-05 checks the next shift in with the code', async () => {
    route({
      [`/provider/bookings/${ID}/shifts`]: [
        {
          dayIndex: 0,
          startsAt: START,
          endsAt: START,
          status: 'scheduled',
          checkedInAt: null,
          checkedOutAt: null,
        },
      ],
    });
    inEnglish(
      <ProviderVisitPanel booking={providerBooking('confirmed', 'shift')} onChanged={onChanged} />,
    );
    fireEvent.change(await screen.findByLabelText("Patient's code"), {
      target: { value: '111222' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => {
      expect(posted(`/provider/bookings/${ID}/shifts/0/check-in`)).toBeTruthy();
    });
  });
});

describe('Support sections (RF-03, SE-06)', () => {
  it('RF-03 SE-06 lists my tickets and every break-glass look', async () => {
    route({
      '/tickets': [{ id: 't1', topic: 'billing', status: 'assigned', createdAt: START }],
      '/me/access-history': [
        {
          adminRole: 'support',
          reason: 'safety_investigation',
          grantedAt: START,
          expiresAt: START,
        },
      ],
    });
    inEnglish(
      <>
        <TicketsSection />
        <AccessSection />
      </>,
    );
    expect(await screen.findByText(/Payment or refund · Being handled/)).toBeTruthy();
    expect(await screen.findByText(/support on .*: safety_investigation/)).toBeTruthy();
  });
});
