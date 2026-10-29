import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { fakeAdminApi } from '../test/fake-api';
import en from '../../messages/en.json';

// jsdom has no <dialog> methods; the Sheet opens and closes through them.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('Admin sign-in (AD-01)', () => {
  it('AD-01 a wrong password is refused with one generic message', async () => {
    fakeAdminApi();
    render(<App />);
    await screen.findByLabelText(en.signIn.email);
    type(en.signIn.email, 'admin@heach.invalid');
    type(en.signIn.password, 'wrong-password');
    fireEvent.click(await screen.findByRole('button', { name: en.signIn.continue }));
    expect(await screen.findByText(en.errors.invalid_credentials)).toBeTruthy();
  });

  it('AD-01 the password leads to TOTP enrolment, and a right code signs in', async () => {
    fakeAdminApi({});
    render(<App />);
    await screen.findByLabelText(en.signIn.email);
    type(en.signIn.email, 'admin@heach.invalid');
    type(en.signIn.password, 'right-password');
    fireEvent.click(await screen.findByRole('button', { name: en.signIn.continue }));
    expect(await screen.findByRole('heading', { name: en.signIn.enrolTitle })).toBeTruthy();
    expect(screen.getByText('ABCDEF')).toBeTruthy();
    type(en.signIn.code, '000000');
    fireEvent.click(screen.getByRole('button', { name: en.signIn.verify }));
    expect(await screen.findByText(en.errors.mfa_incorrect)).toBeTruthy();
    type(en.signIn.code, '123456');
    fireEvent.click(screen.getByRole('button', { name: en.signIn.verify }));
    expect(await screen.findByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.nav.signOut }));
    expect(await screen.findByRole('heading', { name: en.signIn.title })).toBeTruthy();
  });

  it('AD-01 starting again returns to the password step', async () => {
    fakeAdminApi();
    render(<App />);
    await screen.findByLabelText(en.signIn.email);
    type(en.signIn.email, 'admin@heach.invalid');
    type(en.signIn.password, 'right-password');
    fireEvent.click(await screen.findByRole('button', { name: en.signIn.continue }));
    fireEvent.click(await screen.findByRole('button', { name: en.signIn.restart }));
    expect(await screen.findByLabelText(en.signIn.password)).toBeTruthy();
  });
});

describe('Admin users (AD-03)', () => {
  async function openUser() {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: en.nav.users }));
    expect(await screen.findByRole('table', { name: en.users.caption })).toBeTruthy();
    expect(screen.getAllByText('••••••0001').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Open/ }));
    return screen.findByRole('complementary', { name: en.users.detailTitle });
  }

  it('AD-03 lists masked users with search, status filter and pages on the server', async () => {
    const api = fakeAdminApi({ role: 'verifier' });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: en.nav.users }));
    expect(await screen.findByText('Page 1 of 2')).toBeTruthy();
    type(en.users.search, ' 9000000001 ');
    fireEvent.click(screen.getByRole('button', { name: en.users.searchButton }));
    fireEvent.change(screen.getByLabelText(en.users.status), { target: { value: 'suspended' } });
    fireEvent.click(await screen.findByRole('button', { name: en.users.next }));
    await waitFor(() => {
      expect(api.calls.some((call) => call.path === '/users')).toBe(true);
    });
    expect(await screen.findByRole('table', { name: en.users.caption })).toBeTruthy();
  });

  it('AD-03 a verifier sees the details but no suspend control', async () => {
    fakeAdminApi({ role: 'verifier' });
    const panel = await openUser();
    expect(await screen.findByText('Synthetic Patient')).toBeTruthy();
    // ADR 0015: a deferred grant is shown as kept but inactive, in the list and the details.
    expect(panel.textContent).toContain(`doctor (draft, ${en.users.roleDeferred})`);
    expect(screen.getByRole('table').textContent).toContain(
      `patient, doctor (${en.users.roleDeferred})`,
    );
    expect(panel.querySelector('button.heach-button--danger')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.users.close }));
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: en.users.detailTitle })).toBeNull();
    });
  });

  it('AD-03 support suspends after a fresh code, then reinstates', async () => {
    fakeAdminApi({ role: 'support' });
    await openUser();
    fireEvent.change(await screen.findByLabelText(en.users.reason), { target: { value: 'fraud' } });
    fireEvent.click(screen.getByRole('button', { name: en.users.suspend }));
    expect(await screen.findByText(en.reverify.intro)).toBeTruthy();
    type(en.signIn.code, '000000');
    fireEvent.click(screen.getByRole('button', { name: en.reverify.confirm }));
    expect(await screen.findByText(en.errors.mfa_incorrect)).toBeTruthy();
    type(en.signIn.code, '123456');
    fireEvent.click(screen.getByRole('button', { name: en.reverify.confirm }));
    expect(await screen.findByText(en.users.suspended)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: en.users.reinstate }));
    expect(await screen.findByText(en.users.reinstated)).toBeTruthy();
  });
});
