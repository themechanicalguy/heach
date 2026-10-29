import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Application } from '@heach/types';
import type { ReactNode } from 'react';
import type * as ApiModule from '../../lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n-context';
import { IdentityReturn } from './IdentityReturn';
import { OnboardingView } from './OnboardingView';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams('code=approved&ref=ref-12345678'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => state.params,
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: state.api,
}));

const application = (overrides: Partial<Application> = {}): Application => ({
  role: 'nurse',
  status: 'draft',
  statusReason: null,
  identity: 'not_started',
  needsPayout: true,
  payout: null,
  editable: true,
  missing: ['identity', 'police_verification', 'payout'],
  items: [
    { key: 'police_verification', required: true, reference: true, expiry: true, document: null },
    {
      key: 'qualification_certificate',
      required: true,
      reference: false,
      expiry: false,
      document: {
        id: 'd1',
        scanStatus: 'clean',
        reference: null,
        expiresOn: null,
        reviewStatus: 'rejected',
        reviewReason: 'documents_unclear',
        uploadedAt: '2026-10-30T00:00:00Z',
      },
    },
  ],
  ...overrides,
});

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('Nothing found');
  return item;
}

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

beforeEach(() => {
  state.api.mockReset();
  state.replace.mockReset();
});

describe('OnboardingView (J1)', () => {
  it('PO-01 shows the checklist, what is missing, and blocks submit until complete', async () => {
    state.api.mockResolvedValueOnce(application());
    inEnglish(<OnboardingView />);
    expect(await screen.findAllByText('Police verification certificate')).toHaveLength(2);
    expect(screen.getByText('Upload a new file: the document is not clear')).toBeTruthy();
    expect(screen.getByText('Identity check')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Submit for review' }).disabled,
    ).toBe(true);
  });

  it('PO-02 uploads a document with its number and expiry as the upload content type', async () => {
    state.api
      .mockResolvedValueOnce(application())
      .mockResolvedValueOnce(application({ missing: ['identity'] }));
    inEnglish(<OnboardingView />);
    const fileInput = first(await screen.findAllByLabelText(/Choose a file/));
    const file = new File(['%PDF-1.7'], 'police.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Registration or certificate number'), {
      target: { value: 'SYN-1' },
    });
    fireEvent.change(screen.getByLabelText('Valid until'), { target: { value: '2030-01-01' } });
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Upload' })));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledTimes(2);
    });
    const [path, init] = state.api.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/provider/application/documents/police_verification');
    expect(new Headers(init.headers).get('content-type')).toBe('application/vnd.heach.upload+json');
    expect(JSON.parse(init.body as string)).toMatchObject({
      reference: 'SYN-1',
      expiresOn: '2030-01-01',
      contentType: 'application/pdf',
    });
  });

  it('PO-06 saves UPI payout details and shows only the hint afterwards', async () => {
    const saved = application({ payout: { method: 'upi', holderName: 'Synthetic', hint: 'bank' } });
    state.api.mockResolvedValueOnce(application()).mockResolvedValueOnce(saved);
    inEnglish(<OnboardingView />);
    fireEvent.change(await screen.findByLabelText('Account holder name'), {
      target: { value: 'Synthetic' },
    });
    fireEvent.change(screen.getByLabelText('UPI ID'), { target: { value: 'synthetic@okbank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payout account' }));
    expect(await screen.findByText('UPI ending bank, in the name of Synthetic')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Bank account'));
    expect(screen.getByLabelText('IFSC')).toBeTruthy();
  });

  it('PO-04 submits a complete application; a submitted one is read only', async () => {
    const complete = application({ missing: [], identity: 'verified' });
    state.api
      .mockResolvedValueOnce(complete)
      .mockResolvedValueOnce({ ...complete, status: 'submitted', editable: false });
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(
      await screen.findByText('We have your application. We will tell you the result by SMS.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
  });

  it('KY-01 starts the identity check at the partner, and the return page completes it', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { href: window.location.href, assign });
    state.api
      .mockResolvedValueOnce(application())
      .mockResolvedValueOnce({ redirectUrl: 'https://partner.invalid/x' });
    inEnglish(<OnboardingView />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Verify with Aadhaar or DigiLocker' }),
    );
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://partner.invalid/x');
    });
    vi.unstubAllGlobals();

    state.api.mockResolvedValueOnce(application({ identity: 'verified' }));
    inEnglish(<IdentityReturn />);
    await waitFor(() => {
      expect(state.replace).toHaveBeenCalledWith('/en/provider');
    });
    expect(
      JSON.parse((state.api.mock.calls.at(-1) as [string, RequestInit])[1].body as string),
    ).toEqual({
      code: 'approved',
      reference: 'ref-12345678',
    });
  });

  it('KY-01 shows a translated error when the check cannot be completed', async () => {
    const { ApiError } = await import('../../lib/api');
    state.api.mockRejectedValueOnce(new ApiError(409, 'identity_not_pending'));
    inEnglish(<IdentityReturn />);
    expect(await screen.findByText('This identity check has ended. Start it again.')).toBeTruthy();
  });
});
