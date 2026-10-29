import { render, screen } from '@testing-library/react';
import { App } from './App';
import en from '../messages/en.json';

/** Answers the admin API like a server would, for one signed-in sub-role or none. */
function serve(role?: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const json = (status: number, body: unknown) =>
        Promise.resolve(new Response(JSON.stringify(body), { status }));
      if (url.endsWith('/auth/refresh')) {
        return role ? json(200, { accessToken: 'synthetic-token', expiresIn: 600 }) : json(401, {});
      }
      if (url.endsWith('/me')) return json(200, { email: 'admin@heach.invalid', role });
      return json(200, { items: [], total: 0, page: 1, pageSize: 25 });
    }),
  );
}

describe('Admin app', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AD-01 without a session it shows only the sign-in form', async () => {
    serve();
    render(<App />);
    expect(await screen.findByRole('heading', { name: en.signIn.title })).toBeTruthy();
    expect(screen.getByLabelText(en.signIn.email)).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: en.app.navLabel })).toBeNull();
  });

  it('AD-01 a restored super admin session shows the sections of that sub-role', async () => {
    serve('super_admin');
    render(<App />);
    expect(await screen.findByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    expect(screen.getByRole('button', { name: en.nav.users })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: en.dashboard.title })).toBeTruthy();
  });

  it('AD-01 finance does not see user management', async () => {
    serve('finance');
    render(<App />);
    expect(await screen.findByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.nav.users })).toBeNull();
  });
});
