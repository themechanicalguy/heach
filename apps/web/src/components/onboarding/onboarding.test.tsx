import { CATALOGUES } from '@heach/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Application } from '@heach/types';
import type { ReactNode } from 'react';
import type * as ApiModule from '../../lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n-context';
import { IdentityReturn } from './IdentityReturn';
import { OnboardingView } from './OnboardingView';
import { ApplicationSubmittedNotice } from './submitted-notice';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams('code=approved&ref=ref-12345678'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace, push: state.push }),
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
  identityMethod: null,
  identityDocumentKind: null,
  identityConsentVersion: '2026-11-draft.1',
  identityNameMatch: null,
  identityDetailsVerified: false,
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
  document.title = '';
  vi.spyOn(window, 'scrollTo')
    .mockImplementation(() => undefined)
    .mockClear();
  state.api.mockReset();
  state.replace.mockReset();
  state.push.mockReset();
  window.sessionStorage.clear();
});

it.each(['or', 'en', 'hi'] as const)(
  'keeps a localized title through all onboarding steps in %s',
  async (locale) => {
    state.api.mockResolvedValue(application());
    const messages = CATALOGUES[locale];
    render(
      <I18nProvider locale={locale} messages={messages}>
        <OnboardingView />
      </I18nProvider>,
    );
    for (const [index, step] of (
      ['identity', 'documents', 'payout', 'review'] as const
    ).entries()) {
      const label = messages.application.steps[step];
      fireEvent.click(
        await screen.findByRole('button', { name: `${String(index + 1)}. ${label}` }),
      );
      await waitFor(() => {
        expect(document.title).toBe(
          `${label} · ${messages.application.title} · ${messages.app.name}`,
        );
      });
    }
  },
);

describe('OnboardingView (J1)', () => {
  it('PO-01 shows the checklist, what is missing, and blocks submit until complete', async () => {
    state.api.mockResolvedValueOnce(application());
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByRole('button', { name: /Certificates and registration/ }));
    expect(await screen.findAllByText('Police verification certificate')).toHaveLength(1);
    expect(screen.getByText('Upload a new file: the document is not clear')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Identity check/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Review and submit/ }));
    expect(screen.getAllByText('Police verification certificate')).toHaveLength(2);
    expect(screen.getByText('Still needed before you can submit')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Submit application' }).disabled,
    ).toBe(true);
  });

  it('PO-02 uploads a document with its number and expiry as the upload content type', async () => {
    state.api
      .mockResolvedValueOnce(application())
      .mockResolvedValueOnce(application({ missing: ['identity'] }));
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByRole('button', { name: /Certificates and registration/ }));
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
    fireEvent.click(await screen.findByRole('button', { name: /Payout/ }));
    fireEvent.change(await screen.findByLabelText('Account holder name'), {
      target: { value: 'Synthetic' },
    });
    fireEvent.change(screen.getByLabelText('UPI ID'), { target: { value: 'synthetic@okbank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payout account' }));
    expect(await screen.findByText('UPI ending bank, in the name of Synthetic')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Bank account'));
    expect(screen.getByLabelText('IFSC')).toBeTruthy();
  });
});

describe('OnboardingView identity check (KY-01, KY-07, KY-08)', () => {
  it('KY-01 starts the identity check at the partner, and the return page completes it', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { href: window.location.href, assign });
    state.api
      .mockResolvedValueOnce(application())
      .mockResolvedValueOnce({ redirectUrl: 'https://partner.invalid/x' });
    inEnglish(<OnboardingView />);
    const verify = await screen.findByRole('button', { name: 'Verify with Aadhaar or DigiLocker' });
    // Consent comes first: the check cannot start without it.
    expect((verify as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I agree to this identity check'));
    fireEvent.click(verify);
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://partner.invalid/x');
    });
    expect(
      JSON.parse((state.api.mock.calls.at(-1) as [string, RequestInit])[1].body as string),
    ).toEqual({ locale: 'en', consentVersion: '2026-11-draft.1' });
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
    expect(
      screen.getByRole('link', { name: 'Back to your application' }).getAttribute('href'),
    ).toBe('/en/provider');
  });

  it('KY-08 an unreachable partner shows a retry message that points to the fallback', async () => {
    const { ApiError } = await import('../../lib/api');
    state.api
      .mockResolvedValueOnce(application())
      .mockRejectedValueOnce(new ApiError(503, 'identity_unavailable'));
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByLabelText('I agree to this identity check'));
    fireEvent.click(screen.getByRole('button', { name: 'Verify with Aadhaar or DigiLocker' }));
    expect(await screen.findByText(/The identity service is not answering/)).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Verify with Aadhaar or DigiLocker' })
        .disabled,
    ).toBe(false);
  });
});

describe('OnboardingView verified details and fallback (KY-03, KY-07)', () => {
  it('KY-03 shows the verified date of birth and address, and says the name is locked', async () => {
    state.api
      .mockResolvedValueOnce(
        application({
          identity: 'verified',
          identityMethod: 'digilocker',
          identityDetailsVerified: true,
        }),
      )
      .mockResolvedValueOnce({ dateOfBirth: '1990-01-01', address: '1 Synthetic Lane' });
    inEnglish(<OnboardingView />);
    expect(await screen.findByText('1 Synthetic Lane')).toBeTruthy();
    expect(screen.getByText(/1990/)).toBeTruthy();
    expect(screen.getByText(/cannot be edited/)).toBeTruthy();
    expect(state.api.mock.calls.at(-1)?.[0]).toBe('/provider/application/identity/details');
  });

  it('KY-07 uploads another identity document as the fallback, with consent', async () => {
    state.api.mockResolvedValueOnce(application()).mockResolvedValueOnce(
      application({
        identity: 'in_review',
        identityMethod: 'manual',
        identityDocumentKind: 'passport',
        missing: [],
      }),
    );
    inEnglish(<OnboardingView />);
    const upload = await screen.findByRole('button', { name: 'Upload identity document' });
    expect(screen.getByText('Do not upload your Aadhaar card.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Passport'));
    const file = new File(['%PDF-1.7 synthetic'], 'id.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/^Choose a file/), {
      target: { files: [file] },
    });
    expect((upload as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I agree to this identity check'));
    fireEvent.click(upload);
    expect(
      await screen.findByText('Document received. Our team will check it with your application.'),
    ).toBeTruthy();
    expect(screen.getByText('On file: Passport')).toBeTruthy();
    const [path, init] = state.api.mock.calls.at(-1) as [string, RequestInit];
    expect(path).toBe('/provider/application/identity/document');
    expect(JSON.parse(init.body as string)).toMatchObject({
      kind: 'passport',
      locale: 'en',
      consentVersion: '2026-11-draft.1',
      contentType: 'application/pdf',
    });
  });
});

describe('OnboardingView review and submit (J1)', () => {
  it('PO-03 reviews every step read-only, with masked values and a way back to edit', async () => {
    const filled = application({
      missing: [],
      identity: 'verified',
      payout: { method: 'bank', holderName: 'Synthetic', hint: '4321' },
    });
    const withNumber = {
      ...filled,
      items: filled.items.map((entry) =>
        entry.document
          ? {
              ...entry,
              document: { ...entry.document, reference: 'SYN-REG-98765', expiresOn: '2030-01-01' },
            }
          : entry,
      ),
    };
    state.api.mockResolvedValueOnce(withNumber);
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByRole('button', { name: /4. Review and submit/ }));
    expect(screen.getAllByText('Nurse or paramedic')).toHaveLength(2);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Number ••••8765 · Valid until 1 Jan 2030')).toBeTruthy();
    expect(screen.queryByText(/SYN-REG-98765/)).toBeNull();
    expect(screen.getByText('Bank account ending 4321, in the name of Synthetic')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Payout account' }));
    expect(await screen.findByRole('button', { name: 'Save payout account' })).toBeTruthy();
  });

  it('PO-04 submits a complete application and goes home with a one-time notice', async () => {
    const complete = application({ missing: [], identity: 'verified' });
    state.api
      .mockResolvedValueOnce(complete)
      .mockResolvedValueOnce({ ...complete, status: 'submitted', editable: false });
    inEnglish(<OnboardingView />);
    fireEvent.click(await screen.findByRole('button', { name: /4. Review and submit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    await waitFor(() => {
      expect(state.push).toHaveBeenCalledWith('/en');
    });
    expect(state.api.mock.calls[1]?.[0]).toBe('/provider/application/submit');
    expect(window.location.search).toBe('');

    inEnglish(<ApplicationSubmittedNotice />);
    expect(
      await screen.findByText('Application submitted. We will tell you the result by SMS.'),
    ).toBeTruthy();
    cleanup();
    inEnglish(<ApplicationSubmittedNotice />);
    expect(screen.queryByText(/Application submitted/)).toBeNull();
  });

  it('PO-04 shows a submitted application read-only, without submit or edit', async () => {
    state.api.mockResolvedValueOnce(
      application({ status: 'submitted', editable: false, missing: [], identity: 'verified' }),
    );
    inEnglish(<OnboardingView />);
    expect(
      await screen.findByText('We have your application. We will tell you the result by SMS.'),
    ).toBeTruthy();
    expect(screen.getByText(/These details cannot be changed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit application' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(state.push).not.toHaveBeenCalled();
  });
});
