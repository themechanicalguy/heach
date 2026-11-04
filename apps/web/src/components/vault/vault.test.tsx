import { VaultTimeline } from './VaultTimeline';
import { mockBlobUrls } from '../../test/blob-urls';
import { mockDialogs } from '../../test/dialog';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { VaultRecord } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { clientMessages, shellMessages } from '../../lib/client-messages';
import { I18nProvider } from '../../lib/i18n-context';
import { SharedLinkView, SharedRecordsPanel, ShareWithBooking } from './SharePanels';
import { VaultView } from './VaultView';

const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../lib/care-search', () => ({
  useCareSearch: () => ({ person: '', setPerson: vi.fn() }),
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: state.api,
}));

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('Nothing found');
  return item;
}

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider
      locale="en"
      messages={{ ...shellMessages('en'), ...clientMessages('en', 'vault') }}
    >
      {node}
    </I18nProvider>,
  );
const START = '2026-11-02T04:30:00.000Z';
const record = (overrides: Partial<VaultRecord> = {}): VaultRecord => ({
  id: 'r1',
  personId: null,
  source: 'patient',
  recordType: 'scan',
  recordDate: '2025-06-01',
  title: 'Synthetic knee scan',
  facility: 'Synthetic Imaging',
  tags: ['knee'],
  notes: null,
  visitNotes: null,
  issuedBy: null,
  hasFile: true,
  createdAt: START,
  ...overrides,
});

function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/vault/search') return Promise.resolve(responses['/vault'] ?? []);
    const key = Object.keys(responses).find(
      (prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`),
    );
    if (key && !(init?.method && init.method !== 'GET' && !responses[`${init.method} ${key}`]))
      return Promise.resolve(responses[key]);
    return Promise.resolve(init?.method ? responses[`${init.method} ${path}`] : []);
  });
}
const call = (method: string, path: string) =>
  (state.api.mock.calls as [string, RequestInit | undefined][]).find(
    ([called, init]) => called === path && init?.method === method,
  );

beforeEach(() => {
  mockBlobUrls();
  mockDialogs();
  state.api.mockReset();
});

describe('The vault on the web (MV-03 to MV-12)', () => {
  it('MV-06 lists records, filters by type, shows who viewed one, and deletes an own upload', async () => {
    route({
      '/vault/records/r1/access': [
        {
          accessorRole: 'nurse',
          accessorName: 'Synthetic Nurse',
          via: 'booking_share',
          createdAt: START,
        },
      ],
      '/vault/usage': { usedBytes: 1_048_576, quotaBytes: 1_200_000, nearlyFull: true },
      '/vault/history': [
        {
          id: 'h1',
          personId: null,
          kind: 'allergy',
          text: 'Synthetic allergy',
          addedByRole: 'patient',
          createdAt: START,
        },
      ],
      '/vault': [
        record(),
        record({
          id: 'r2',
          source: 'visit',
          recordType: 'visit_note',
          title: 'Wound care',
          issuedBy: 'Synthetic Nurse',
          hasFile: false,
          visitNotes: { procedure: 'Dressing', observations: 'Healing', advice: 'Rest' },
        }),
      ],
    });
    inEnglish(<VaultView />);
    expect((await screen.findAllByText('Synthetic knee scan')).length).toBeGreaterThan(0);
    // G10: browsing first; adding and sharing are not on the page until asked for.
    expect(screen.queryByRole('button', { name: 'Save record' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create link' })).toBeNull();
    expect(screen.getByText('Issued by Synthetic Nurse')).toBeTruthy();
    expect(screen.getByText('Your storage is nearly full.')).toBeTruthy();
    expect(await screen.findByText(/Synthetic allergy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Scan' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/vault/search', {
        method: 'POST',
        body: JSON.stringify({ person: 'self', type: 'scan' }),
      });
    });
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Who viewed' })));
    expect(await screen.findByText(/Synthetic Nurse via booking share/)).toBeTruthy();
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Delete' })));
    await waitFor(() => {
      expect(call('DELETE', '/vault/records/r1')).toBeTruthy();
    });
  });
});

describe('Focused vault tasks (G10, G12; MV-03, MV-05, MV-09)', () => {
  it('MV-03 uploads a record with tags and a file; MV-05 adds history; MV-09 creates a link', async () => {
    route({
      '/vault': [record()],
      '/vault/usage': { usedBytes: 0, quotaBytes: 1, nearlyFull: false },
      'POST /vault/links': {
        id: 'l1',
        token: 'token-1234567890abcdefghij',
        code: '654321',
        expiresAt: START,
      },
    });
    inEnglish(<VaultView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add record' }));
    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Synthetic discharge' },
    });
    fireEvent.change(screen.getByLabelText('Date of the record'), {
      target: { value: '2025-01-02' },
    });
    fireEvent.change(screen.getByLabelText('Tags, separated by commas (optional)'), {
      target: { value: 'ward, surgery' },
    });
    fireEvent.change(screen.getByLabelText('File (PDF, JPG or PNG)'), {
      target: { files: [new File(['%PDF'], 'd.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => {
      expect(JSON.parse(call('POST', '/vault/records')?.[1]?.body as string)).toMatchObject({
        title: 'Synthetic discharge',
        tags: ['ward', 'surgery'],
        file: { contentType: 'application/pdf' },
      });
    });
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save record' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'Synthetic asthma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(JSON.parse(call('POST', '/vault/history')?.[1]?.body as string)).toEqual({
        kind: 'allergy',
        text: 'Synthetic asthma',
      });
    });
    // G12: Share on a record opens the link task with that record already chosen.
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Share' })));
    const chosen = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Synthetic knee scan' });
    expect(chosen.checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '72 hours' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => {
      expect(JSON.parse(call('POST', '/vault/links')?.[1]?.body as string)).toEqual({
        recordIds: ['r1'],
        hours: 72,
      });
    });
    expect(await screen.findByText(/Code: 654321/)).toBeTruthy();
  });
});

describe('Sharing on the web (MV-07 to MV-09, MV-14)', () => {
  it('MV-07 the patient shares chosen records with the booking and can revoke', async () => {
    route({
      '/vault/shares': [
        {
          id: 's1',
          bookingId: 'b1',
          recordIds: ['r1'],
          includeHistory: false,
          expiresAt: START,
          revokedAt: null,
        },
      ],
      '/vault': [record()],
    });
    inEnglish(<ShareWithBooking bookingId="b1" />);
    fireEvent.click(await screen.findByLabelText('Synthetic knee scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Share selected' }));
    await waitFor(() => {
      expect(JSON.parse(call('POST', '/vault/shares')?.[1]?.body as string)).toEqual({
        bookingId: 'b1',
        recordIds: ['r1'],
        includeHistory: false,
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(call('POST', '/vault/shares/s1/revoke')).toBeTruthy();
    });
  });

  it('MV-08 MV-14 the provider sees only shared records and adds one to the patient file', async () => {
    route({
      '/provider/bookings/b1/shared': {
        records: [record()],
        history: [
          {
            id: 'h1',
            personId: null,
            kind: 'condition',
            text: 'Synthetic diabetes',
            addedByRole: 'patient',
            createdAt: START,
          },
        ],
        files: [],
      },
    });
    inEnglish(<SharedRecordsPanel bookingId="b1" />);
    expect(await screen.findByText('Synthetic knee scan')).toBeTruthy();
    expect(screen.getByText(/Synthetic diabetes/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a record to the patient's file"), {
      target: { value: 'Dressing chart' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    expect(await screen.findByText("Added to the patient's records.")).toBeTruthy();
  });

  it('MV-09 a doctor opens a link with its code and sees the files', async () => {
    route({
      'POST /shared-records/token-1234567890abcdefghij': {
        records: [record()],
        history: [],
        files: [{ recordId: 'r1', contentType: 'application/pdf', contentBase64: 'JVBERg==' }],
      },
    });
    inEnglish(<SharedLinkView token="token-1234567890abcdefghij" />);
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open records' }));
    expect((await screen.findByRole('link', { name: 'Open file' })).getAttribute('href')).toBe(
      'blob:http://localhost/synthetic-file',
    );
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('G11 keeps authorship and type visible in the row while clinical details stay collapsed', () => {
  inEnglish(
    <VaultTimeline
      records={[
        record({
          source: 'visit',
          issuedBy: 'Synthetic Nurse',
          visitNotes: {
            procedure: 'Synthetic dressing',
            observations: 'Synthetic observations',
            advice: 'Synthetic advice',
          },
        }),
      ]}
      onRefresh={() => Promise.resolve()}
      onShare={vi.fn()}
    />,
  );
  const badge = screen.getByText('Issued by Synthetic Nurse');
  expect(badge.closest('summary')).toBeTruthy();
  expect(badge.getAttribute('data-source')).toBe('provider');
  const notes = screen.getByText('Synthetic dressing');
  expect(notes.closest('summary')).toBeNull();
  expect(notes.closest('details')?.open).toBe(false);
});
