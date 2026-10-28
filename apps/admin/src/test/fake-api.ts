import type { UserDetail } from '@heach/types';

type Handler = (body: Record<string, string>) => Promise<Response>;

const json = (status: number, body?: unknown) =>
  Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));

function syntheticUser(): UserDetail {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: 'S•••••••• P••••••',
    fullName: 'Synthetic Patient',
    mobile: '••••••0001',
    status: 'active',
    suspensionReason: null,
    roles: [{ role: 'nurse', side: 'provider', applicationStatus: 'draft', statusReason: null }],
    setupComplete: true,
    createdAt: '2026-10-29T00:00:00.000Z',
    lastSignInAt: null,
  };
}

/** A small stand-in for the admin API in component tests; records the calls it gets. */
export function fakeAdminApi(options: { role?: string } = {}) {
  const calls: { method: string; path: string }[] = [];
  const state = { signedIn: Boolean(options.role), reverified: false };
  const user = syntheticUser();
  const token = { accessToken: 'synthetic-token-123456789' };
  const routes: Record<string, Handler> = {
    'POST /auth/refresh': () => (state.signedIn ? json(200, token) : json(401, {})),
    'GET /me': () => json(200, { email: 'admin@heach.invalid', role: options.role ?? 'support' }),
    'POST /auth/password': (body) =>
      body.password === 'right-password'
        ? json(200, {
            mfaTicket: 'ticket-12345678901234567890',
            enrolment: { secret: 'ABCDEF', uri: 'otpauth://totp/x' },
          })
        : json(401, { code: 'invalid_credentials' }),
    'POST /auth/mfa': (body) => {
      if (body.code !== '123456') return json(401, { code: 'mfa_incorrect' });
      state.signedIn = true;
      return json(200, token);
    },
    'POST /auth/logout': () => {
      state.signedIn = false;
      return json(204);
    },
    'POST /auth/reverify': (body) => {
      state.reverified = body.code === '123456';
      return state.reverified ? json(204) : json(401, { code: 'mfa_incorrect' });
    },
    'GET /users': () => json(200, { items: [user], total: 30, page: 1, pageSize: 25 }),
    [`GET /users/${user.id}`]: () => json(200, user),
    [`POST /users/${user.id}/suspend`]: () => {
      if (!state.reverified) return json(403, { code: 'reverification_required' });
      user.status = 'suspended';
      return json(204);
    },
    [`POST /users/${user.id}/reinstate`]: () => {
      user.status = 'active';
      return json(204);
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const path = url.replace('/api/admin/v1', '').split('?')[0] ?? '';
      const body = init.body ? (JSON.parse(init.body as string) as Record<string, string>) : {};
      calls.push({ method, path });
      return (routes[`${method} ${path}`] ?? (() => json(404, {})))(body);
    }),
  );
  return { calls, user };
}
