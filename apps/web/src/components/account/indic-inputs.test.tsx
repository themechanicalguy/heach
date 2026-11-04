import { CATALOGUES } from '@heach/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { LinkedPatientForm } from '../people/LinkedPatientForm';
import { CodeStep } from './CodeStep';
import { MobileStep } from './MobileStep';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn() }));
const show = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each(['୯୮୭୬୫୪୩୨୧୦', '९८७६५४३२१०'])('sends mobile %s as ASCII', async (mobile) => {
  vi.mocked(api).mockResolvedValue({
    challengeId: 'synthetic',
    expiresInSeconds: 300,
    resendInSeconds: 30,
  });
  const onSent = vi.fn();
  show(<MobileStep onSent={onSent} />);
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.signIn.mobileLabel), {
    target: { value: mobile },
  });
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.signIn.sendCode }));
  await waitFor(() => {
    expect(onSent).toHaveBeenCalled();
  });
  expect(api).toHaveBeenCalledWith(
    '/auth/otp',
    expect.objectContaining({ body: JSON.stringify({ mobile: '9876543210', locale: 'en' }) }),
  );
});

it('keeps Indic OTP digits before the ASCII-only filter', async () => {
  vi.mocked(api).mockResolvedValue({ accessToken: 'synthetic' });
  const onSignedIn = vi.fn().mockResolvedValue(undefined);
  show(
    <CodeStep
      challenge={{ challengeId: 'synthetic', expiresInSeconds: 300, resendInSeconds: 30 }}
      lastDigits="3210"
      onSignedIn={onSignedIn}
      onChangeNumber={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.signIn.codeLabel), {
    target: { value: '୧२୩४୫६' },
  });
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.signIn.verify }));
  await waitFor(() => {
    expect(onSignedIn).toHaveBeenCalledWith('synthetic');
  });
  expect(api).toHaveBeenCalledWith(
    '/auth/otp/verify',
    expect.objectContaining({
      body: JSON.stringify({ challengeId: 'synthetic', code: '123456', locale: 'en' }),
    }),
  );
});

it('keeps Indic birth-year digits before filtering and saves the numeric year', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  show(
    <LinkedPatientForm
      person={{
        fullName: 'Synthetic Person',
        birthYear: 1950,
        gender: 'female',
        relationship: 'parent',
      }}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.people.birthYear), {
    target: { value: '୧९୬०' },
  });
  const form = screen.getByLabelText(CATALOGUES.en.people.birthYear).closest('form');
  if (!form) throw new Error('Missing linked patient form');
  fireEvent.submit(form);
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ birthYear: 1960 }));
  });
});
