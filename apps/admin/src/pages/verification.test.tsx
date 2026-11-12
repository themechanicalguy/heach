import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationReview, ApplicationSummary } from '@heach/types';
import { Applications } from './Applications';
import en from '../../messages/en.json';

const ACCOUNT = '00000000-0000-4000-8000-0000000000bb';

function review(
  status: ApplicationReview['status'],
  overrides: Partial<ApplicationReview> = {},
): ApplicationReview {
  return {
    accountId: ACCOUNT,
    fullName: 'Synthetic Nurse',
    role: 'nurse',
    status,
    statusReason: null,
    identity: 'verified',
    identityMethod: 'digilocker',
    identityDocumentKind: null,
    identityConsentVersion: '2026-11-draft.1',
    identityNameMatch: 'match',
    identityDetailsVerified: true,
    profile: {
      qualifications: 'GNM, synthetic',
      experienceYears: 7,
      hasPhoto: false,
      photoVerified: false,
    },
    assisted: false,
    identityConsentAssisted: false,
    providerConsentDue: false,
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
          source: 'digilocker',
          issuer: 'Synthetic Police Office',
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
    ...overrides,
  };
}

function stubApi(
  status: ApplicationReview['status'] = 'under_review',
  overrides: Partial<ApplicationReview> = {},
  queued: Partial<ApplicationSummary> = {},
) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const queue: ApplicationSummary[] = [
    {
      accountId: ACCOUNT,
      role: 'nurse',
      status: 'submitted',
      fullName: 'Synthetic Nurse',
      submittedAt: '2026-10-30T00:00:00Z',
      assisted: false,
      assistedByYou: false,
      ...queued,
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
      if (path.includes('/documents/') || path.endsWith('/identity-document')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ contentType: 'application/pdf', contentBase64: btoa('%PDF') }),
          ),
        );
      }
      if (method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify(review(status, overrides))));
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

  it('KY-09 shows how identity was checked', async () => {
    stubApi();
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(en.verification.identityMethods.digilocker)).toBeTruthy();
    // PO-05: what the provider will publish.
    expect(screen.getByText('GNM, synthetic')).toBeTruthy();
    expect(screen.getByText(en.verification.noPhoto)).toBeTruthy();
    // KY-02: a copy shared from DigiLocker names its issuer.
    expect(screen.getByText(/Issued copy from DigiLocker: Synthetic Police Office/)).toBeTruthy();
    expect(screen.queryByText(en.verification.identityDocument)).toBeNull();
  });

  it('KY-04 a name that differed from the verified one is flagged', async () => {
    stubApi('under_review', { identityNameMatch: 'mismatch' });
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(en.verification.nameMismatch)).toBeTruthy();
    expect(screen.getByText(en.verification.nameMatches.mismatch)).toBeTruthy();
  });

  it('KY-07 a verifier opens the fallback identity document and accepts it', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:synthetic');
    const calls = stubApi('under_review', {
      identity: 'in_review',
      identityMethod: 'manual',
      identityDocumentKind: 'passport',
      identityNameMatch: null,
      identityDetailsVerified: false,
      items: [],
    });
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(en.verification.identityStates.in_review)).toBeTruthy();
    expect(screen.getByText(en.verification.identityKinds.passport)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.verification.download }));
    expect(await screen.findByRole('link', { name: en.verification.download })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.verification.accept }));
    await waitFor(() => {
      expect(calls.find((call) => call.path.endsWith('/identity'))?.body).toEqual({
        status: 'accepted',
      });
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

describe('Verification of assisted applications (AD-12)', () => {
  it('AD-12 the admin who assisted cannot open the review', async () => {
    stubApi('under_review', {}, { assisted: true, assistedByYou: true });
    render(<Applications />);
    expect(await screen.findByText(en.verification.assistedByYou)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Review/ })).toBeNull();
  });

  it('AD-12 another verifier sees how the application came about and what blocks approval', async () => {
    stubApi('under_review', {
      assisted: true,
      identityConsentAssisted: true,
      providerConsentDue: true,
    });
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    expect(await screen.findByText(en.verification.assisted)).toBeTruthy();
    expect(screen.getByText(en.verification.assistedConsent)).toBeTruthy();
    expect(screen.getByText(en.verification.consentDue)).toBeTruthy();
  });

  it('AD-12 an application the provider onboarded alone shows none of these notices', async () => {
    stubApi();
    render(<Applications />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.verification.open} Synthetic Nurse` }),
    );
    await screen.findByText(en.verification.statuses.under_review);
    expect(screen.queryByText(en.verification.assisted)).toBeNull();
    expect(screen.queryByText(en.verification.consentDue)).toBeNull();
  });
});
