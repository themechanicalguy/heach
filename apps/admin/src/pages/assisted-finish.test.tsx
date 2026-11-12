import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import en from '../../messages/en.json';
import { application, serveAssisted, session } from '../test/assisted-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openStep(step: keyof typeof en.assisted.steps) {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: en.nav.assisted }));
  fireEvent.click(await screen.findByRole('button', { name: en.assisted.steps[step] }));
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('Assisted onboarding: payout (PO-06, AD-12)', () => {
  it('AD-12 payout needs the provider code and a fresh authenticator code, and is never shown back', async () => {
    const { calls } = serveAssisted(session());
    await openStep('payout');
    expect(screen.queryByLabelText(en.assisted.payout.code)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.assisted.payout.sendCode }));
    const save = await screen.findByRole('button', { name: en.assisted.payout.save });
    expect(save).toHaveProperty('disabled', true);
    type(en.assisted.payout.code, '654321');
    type(en.assisted.payout.holderName, 'Synthetic Nurse');
    type(en.assisted.payout.upiId, 'synthetic@upi');
    fireEvent.click(save);
    type(en.signIn.code, '123456');
    fireEvent.click(await screen.findByRole('button', { name: en.reverify.confirm, hidden: true }));
    expect(await screen.findByText(en.assisted.payout.onFile)).toBeTruthy();
    const puts = calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/payout'));
    expect(puts).toHaveLength(2);
    expect(puts[1]?.body).toEqual({
      code: '654321',
      holderName: 'Synthetic Nurse',
      method: 'upi',
      upiId: 'synthetic@upi',
    });
    expect(screen.queryByDisplayValue('synthetic@upi')).toBeNull();
  });

  it('PO-06 a role without payouts has no payout step', async () => {
    serveAssisted(session({ application: application({ needsPayout: false }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: en.nav.assisted }));
    await screen.findByRole('heading', { name: en.assisted.steps.documents });
    expect(screen.queryByRole('button', { name: en.assisted.steps.payout })).toBeNull();
  });
});

describe('Assisted onboarding: review and submit (AD-12)', () => {
  it('AD-12 submit stays off while anything is missing', async () => {
    serveAssisted(session());
    await openStep('review');
    expect(await screen.findByText(/nursing_registration, payout/)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.assisted.review.submit })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('AD-12 submitting ends the session and says so', async () => {
    const { calls } = serveAssisted(session({ application: application({ missing: [] }) }));
    await openStep('review');
    fireEvent.click(await screen.findByRole('button', { name: en.assisted.review.submit }));
    expect(await screen.findByText(en.assisted.review.submitted)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText(en.assisted.mobile)).toBeTruthy();
    });
    expect(calls.some((call) => call.path.endsWith('/submit'))).toBe(true);
  });
});
