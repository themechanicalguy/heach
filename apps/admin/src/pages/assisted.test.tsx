import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import en from '../../messages/en.json';
import { application, serveAssisted, session } from '../test/assisted-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openAssisted() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: en.nav.assisted }));
}

describe('Assisted onboarding: shell (AD-12)', () => {
  it.each(['support', 'super_admin'])(
    'AD-12 %s sees the Assisted onboarding section',
    async (role) => {
      serveAssisted(null, role);
      render(<App />);
      expect(await screen.findByRole('button', { name: en.nav.assisted })).toBeTruthy();
    },
  );

  it.each(['verifier', 'finance'])('AD-12 %s does not see the section', async (role) => {
    serveAssisted(null, role);
    render(<App />);
    expect(await screen.findByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.nav.assisted })).toBeNull();
  });
});

describe('Assisted onboarding: consent (AD-12)', () => {
  it('AD-12 asks for a fresh authenticator code, then shows the masked number and a resend wait', async () => {
    const { calls } = serveAssisted(null);
    await openAssisted();
    fireEvent.change(await screen.findByLabelText(en.assisted.mobile), {
      target: { value: '9000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.assisted.sendCode }));
    fireEvent.change(await screen.findByLabelText(en.signIn.code), { target: { value: '123456' } });
    fireEvent.click(await screen.findByRole('button', { name: en.reverify.confirm, hidden: true }));
    expect(await screen.findByText(/••••••4321/)).toBeTruthy();
    expect(screen.getByText('You can send it again in 30 s')).toBeTruthy();
    expect(screen.getByRole('button', { name: en.assisted.resend })).toHaveProperty(
      'disabled',
      true,
    );
    const send = calls.filter((call) => call.path === '/assisted-onboarding/consent');
    expect(send).toHaveLength(2);
    expect(send[1]?.body).toEqual({ mobile: '9000000000', locale: 'or' });
    expect(calls.every((call) => !call.path.includes('9000000000'))).toBe(true);
  });

  it('AD-12 a wrong code shows the reason; the right code opens the details step', async () => {
    const { state } = serveAssisted(null);
    state.reverified = true;
    await openAssisted();
    fireEvent.change(await screen.findByLabelText(en.assisted.mobile), {
      target: { value: '9000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.assisted.sendCode }));
    const code = await screen.findByLabelText(en.assisted.code);
    fireEvent.change(code, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: en.assisted.verify }));
    expect(await screen.findByText(en.errors.otp_incorrect)).toBeTruthy();
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: en.assisted.verify }));
    expect(await screen.findByRole('heading', { name: en.assisted.steps.details })).toBeTruthy();
  });
});

describe('Assisted onboarding: details and session (AD-12)', () => {
  it('AD-12 an account with a name and gender does not ask for them again', async () => {
    const { calls } = serveAssisted(session({ application: null, basicDetailsLocked: true }));
    await openAssisted();
    expect(await screen.findByText(en.assisted.details.locked)).toBeTruthy();
    expect(screen.queryByLabelText(en.assisted.details.fullName)).toBeNull();
    expect(screen.queryByLabelText(en.assisted.details.adult)).toBeNull();
    fireEvent.click(screen.getByLabelText(en.assisted.details.roles.nurse));
    fireEvent.click(screen.getByLabelText(en.assisted.locales.or));
    fireEvent.click(screen.getByRole('button', { name: en.assisted.details.save }));
    await waitFor(() => {
      expect(calls.find((call) => call.path.endsWith('/details'))?.body).toEqual({
        role: 'nurse',
        languages: ['or'],
      });
    });
    expect(await screen.findByRole('heading', { name: en.assisted.steps.documents })).toBeTruthy();
  });

  it('AD-12 a new account needs every basic detail before it can be saved', async () => {
    serveAssisted(session({ application: null }));
    await openAssisted();
    const save = await screen.findByRole('button', { name: en.assisted.details.save });
    fireEvent.click(screen.getByLabelText(en.assisted.details.roles.attendant));
    fireEvent.click(screen.getByLabelText(en.assisted.locales.en));
    fireEvent.change(screen.getByLabelText(en.assisted.details.fullName), {
      target: { value: 'Synthetic Person' },
    });
    fireEvent.click(screen.getByLabelText(en.assisted.details.genders.female));
    expect(save).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText(en.assisted.details.adult));
    expect(save).toHaveProperty('disabled', false);
  });

  it('AD-12 ending the session shows the start screen and the ended notice', async () => {
    serveAssisted(session({ application: application() }));
    await openAssisted();
    expect(await screen.findByText(/••••••4321/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.assisted.end }));
    expect(await screen.findByText(en.assisted.ended)).toBeTruthy();
    expect(screen.getByLabelText(en.assisted.mobile)).toBeTruthy();
  });
});
