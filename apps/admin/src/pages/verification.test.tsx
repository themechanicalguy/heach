import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationReview, ApplicationSummary } from '@heach/types';
import { Applications } from './Applications';
import { waitingDays } from './waiting';
import en from '../../messages/en.json';

const ACCOUNT = '00000000-0000-4000-8000-0000000000bb';

function review(status: ApplicationReview['status']): ApplicationReview {
  return {
    accountId: ACCOUNT,
    fullName: 'Synthetic Nurse',
    role: 'nurse',
    status,
    statusReason: null,
    identity: 'verified',
    needsPayout: true,
    payout: { method: 'upi', holderName: 'Synthetic Nurse', hint: 'bank' },
    editable: false,
    missing: [],
    items: [
      {
        key: 'police_verification',
        required: true,
        reference: true,
        expiry: true,
        document: {
          id: '00000000-0000-4000-8000-0000000000dd',
          scanStatus: 'clean',
          reference: 'SYN-1',
          expiresOn: '2030-01-01',
          reviewStatus: 'pending',
          reviewReason: null,
          uploadedAt: '2026-10-30T00:00:00Z',
        },
      },
      {
        key: 'training_certificate',
        required: false,
        reference: false,
        expiry: false,
        document: null,
      },
    ],
    history: [
      {
        fromStatus: 'submitted',
        toStatus: 'under_review',
        reason: null,
        actorRole: 'verifier',
        createdAt: '2026-10-30T00:00:00Z',
      },
    ],
  };
}

function stubApi(status: ApplicationReview['status'] = 'under_review') {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const queue: ApplicationSummary[] = [
    {
      accountId: ACCOUNT,
      role: 'nurse',
      status: 'submitted',
      fullName: 'Synthetic Nurse',
      submittedAt: '2026-10-30T00:00:00Z',
      identity: 'verified',
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const path = url.replace('/api/admin/v1', '');
      calls.push({
        method,
        path,
        body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      });
      if (path === '/applications/search') {
        const filters = JSON.parse(init.body as string) as { view?: string };
        return Promise.resolve(
          new Response(JSON.stringify(filters.view === 'decided' ? [] : queue)),
        );
      }
      if (path.includes('/documents/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ contentType: 'application/pdf', contentBase64: btoa('%PDF') }),
          ),
        );
      }
      if (method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify(review(status))));
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Verification queue (AD-02)', () => {
  it('AD-02 lists waiting applications and shows decided ones on request', async () => {
    stubApi();
    render(<Applications />);
    expect(await screen.findByText('Synthetic Nurse')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.verification.status), {
      target: { value: 'decided' },
    });
    expect(await screen.findByText(en.verification.empty)).toBeTruthy();
  });

  it('G17 filters in the request body and shows the type, waiting time and identity result', async () => {
    const calls = stubApi();
    render(<Applications />);
    expect(await screen.findByText('Synthetic Nurse')).toBeTruthy();
    const row = screen.getByText('Synthetic Nurse').closest('tr');
    expect(row?.textContent).toContain(en.checklists.roles.nurse);
    expect(row?.textContent).not.toMatch(/\bnurse\b/);
    expect(row?.textContent).toContain(en.verification.identityStates.verified);
    const days = waitingDays('2026-10-30T00:00:00Z') ?? 0;
    expect(row?.textContent).toContain(
      days === 0 ? en.verification.waitingToday : `${String(days)} day`,
    );
    fireEvent.change(screen.getByLabelText(en.verification.role), { target: { value: 'nurse' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' Synthetic ' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => {
      expect(calls.at(-1)).toEqual({
        method: 'POST',
        path: '/applications/search',
        body: { view: 'open', role: 'nurse', q: 'Synthetic' },
      });
    });
    expect(calls.every((call) => !call.path.includes('Synthetic'))).toBe(true);
  });

  it('AD-02 opens an application, its document, reviews it and approves', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:synthetic');
    const calls = stubApi();
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(/SYN-1/)).toBeTruthy();
    expect(screen.getByText(new RegExp(en.checklists.items.training_certificate))).toBeTruthy();
    expect(screen.queryByText(/police_verification|training_certificate/)).toBeNull();
    // G18: opening a document goes to the focused review, the file fetched through the API.
    fireEvent.click(screen.getByRole('button', { name: en.verification.download }));
    expect(await screen.findByTitle(en.checklists.items.police_verification)).toBeTruthy();
    expect(calls.some((call) => call.path.includes('/documents/'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: en.verification.reject }));
    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/documents') && call.method === 'POST')).toBe(
        true,
      );
    });
    const requestChanges = await screen.findByRole<HTMLButtonElement>('button', {
      name: en.verification.requestChanges,
    });
    expect(requestChanges.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(en.verification.reason), {
      target: { value: 'documents_expired' },
    });
    fireEvent.click(requestChanges);
    expect(await screen.findByText(en.verification.decided)).toBeTruthy();
    expect(calls.find((call) => call.path.endsWith('/decision'))?.body).toEqual({
      decision: 'request_changes',
      reason: 'documents_expired',
    });
  });

  it('AD-02 an application not in review has no decision buttons and can be closed', async () => {
    stubApi('approved');
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(en.verification.statuses.approved)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.verification.approve })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.verification.close }));
    await waitFor(() => {
      expect(screen.queryByText(en.verification.detailTitle)).toBeNull();
    });
  });
});
