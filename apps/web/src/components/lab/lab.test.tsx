import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import type { LabOrder } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { CollectionsView, LabOrdersView } from './LabOrdersView';
import { PatientLabPanel } from './PatientLabPanel';

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

const order = (overrides: Partial<LabOrder> = {}): LabOrder => ({
  bookingId: 'b1',
  status: 'confirmed',
  collection: 'home',
  stage: 'collector_assigned',
  startsAt: START,
  items: [
    {
      itemCode: 'lab_cbc',
      name: 'Complete blood count (CBC)',
      feePaise: 30_000,
      sampleType: 'blood',
    },
  ],
  collector: { id: 'c1', name: 'Synthetic Collector', verified: true },
  sampleId: null,
  reportHours: 24,
  reportDueAt: null,
  events: [],
  reports: [],
  address: '12 Synthetic Lane',
  ...overrides,
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

beforeEach(() => {
  state.api.mockReset();
});

describe('Lab orders on the web (LB-05 to LB-11)', () => {
  it('LB-05 LB-06 the patient sees the collector and the collection code; LB-08 downloads the report', async () => {
    route({
      '/bookings/b1/lab/code': { code: '123456', moment: 'collect' },
      '/bookings/b1/lab': order(),
    });
    const view = inEnglish(<PatientLabPanel bookingId="b1" />);
    expect(await screen.findByText('Collector: Synthetic Collector · Verified')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show collection code' }));
    expect(await screen.findByText('Your code: 123456')).toBeTruthy();
    view.unmount();
    route({
      '/bookings/b1/lab/report': { contentType: 'application/pdf', contentBase64: 'JVBERg==' },
      '/bookings/b1/lab': order({
        stage: 'report_ready',
        sampleId: 'HX-0123456789',
        reports: [
          { version: 2, correctionReason: 'wrong_value', createdAt: START },
          { version: 1, correctionReason: null, createdAt: START },
        ],
      }),
    });
    inEnglish(<PatientLabPanel bookingId="b1" />);
    expect(await screen.findByText('Sample ID: HX-0123456789')).toBeTruthy();
    expect(screen.getByText(/Corrected: Wrong value/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download report' }));
    expect(
      (await screen.findByRole('link', { name: 'Download report' })).getAttribute('href'),
    ).toBe('data:application/pdf;base64,JVBERg==');
  });

  it('LB-11 the lab sees its dashboard, assigns a collector and marks a sample received', async () => {
    route({
      '/provider/lab/dashboard': {
        todayCollections: 3,
        pendingReports: 1,
        averageTurnaroundHours: 20,
        lateReports: 0,
      },
      '/provider/lab/collectors': [{ id: 'c1', name: 'Synthetic Collector', verified: true }],
      '/provider/lab/orders': [
        order({ stage: 'booked', collector: null }),
        order({ bookingId: 'b2', stage: 'sample_collected', sampleId: 'HX-0123456789' }),
      ],
    });
    inEnglish(<LabOrdersView />);
    expect(
      await screen.findByText('Today: 3 collections · 1 reports pending · average 20 h · 0 late'),
    ).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Assign collector' }));
    await waitFor(() => {
      expect(JSON.parse(posted('/provider/lab/orders/b1/collector')?.[1]?.body as string)).toEqual({
        collectorId: 'c1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark received' }));
    await waitFor(() => {
      expect(posted('/provider/lab/orders/b2/received')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for a new sample' }));
    await waitFor(() => {
      expect(JSON.parse(posted('/provider/lab/orders/b2/recollect')?.[1]?.body as string)).toEqual({
        reason: 'insufficient_sample',
      });
    });
  });

  it('LB-08 LB-10 the lab uploads a report against the sample ID, and a correction with a reason', async () => {
    route({
      '/provider/lab/orders': [order({ stage: 'report_ready', sampleId: 'HX-0123456789' })],
      '/provider/lab/dashboard': {},
    });
    inEnglish(<LabOrdersView />);
    fireEvent.change(await screen.findByLabelText('Upload report (PDF)'), {
      target: { files: [new File(['%PDF'], 'r.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.change(screen.getByLabelText('Sample ID on the tube'), {
      target: { value: 'hx-0123456789' },
    });
    fireEvent.change(screen.getByLabelText('Correction reason'), {
      target: { value: 'missing_test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => {
      expect(
        JSON.parse(posted('/provider/lab/orders/b1/report')?.[1]?.body as string),
      ).toMatchObject({
        sampleId: 'HX-0123456789',
        correctionReason: 'missing_test',
        contentType: 'application/pdf',
      });
    });
  });
});

describe('Home collection by the collector (LB-06)', () => {
  it('LB-06 a collector sees the address and confirms collection with the code', async () => {
    route({
      '/provider/collections/b1/collect': { sampleId: 'HX-0123456789' },
      '/provider/collections': [order()],
    });
    inEnglish(<CollectionsView />);
    expect(await screen.findByText('12 Synthetic Lane')).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Patient's code"), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm collection' }));
    expect(await screen.findByText('Collected. Sample ID HX-0123456789.')).toBeTruthy();
  });
});
