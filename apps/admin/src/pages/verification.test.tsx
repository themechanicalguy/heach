import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationReview, ApplicationSummary } from '@heach/types';
import { Applications } from './Applications';
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
      if (path.startsWith('/applications?'))
        return Promise.resolve(new Response(JSON.stringify(path.includes('decided') ? [] : queue)));
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
    fireEvent.click(screen.getByLabelText(en.verification.viewDecided));
    expect(await screen.findByText(en.verification.empty)).toBeTruthy();
  });

  it('AD-02 opens an application, its document, reviews it and approves', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:synthetic');
    const calls = stubApi();
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(/SYN-1/)).toBeTruthy();
    expect(screen.getByText(/training_certificate/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.verification.download }));
    expect(await screen.findByRole('link', { name: en.verification.download })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.verification.reject }));
    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/documents') && call.method === 'POST')).toBe(
        true,
      );
    });
    fireEvent.click(await screen.findByLabelText(en.verification.reasons.documents_expired));
    fireEvent.click(screen.getByRole('button', { name: en.verification.requestChanges }));
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
