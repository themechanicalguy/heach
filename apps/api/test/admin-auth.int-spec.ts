import type request from 'supertest';
import { AdminAccountRepository } from '../src/admin/admin-account.repository.js';
import { hashPassword } from '../src/admin/password.js';
import { stepAt, totpAt } from '../src/admin/totp.js';
import type { AdminRole } from '../src/common/request-context.js';
import {
  ADMIN_PASSWORD,
  adminSignIn,
  nextTotp,
  otpSignIn,
  signedUp,
  useApp,
} from './account-helpers.js';
import { bearer, fromResponse, type Login } from './auth-helpers.js';
import { captureOutput } from './capture-output.js';

/** Admin creation and the password step, bound to one block's app. */
function adminCalls(fixture: ReturnType<typeof useApp>) {
  const newAdmin = async (email: string, role: AdminRole = 'verifier') =>
    fixture
      .app()
      .get(AdminAccountRepository)
      .create({ email, passwordHash: await hashPassword(ADMIN_PASSWORD), role });
  const password = (email: string, value = ADMIN_PASSWORD) =>
    fixture.server().post('/admin/v1/auth/password').send({ email, password: value });
  return { newAdmin, password };
}

/** The user ID behind a session, found from its refresh cookie's hash. */
async function userId(fixture: ReturnType<typeof useApp>, login: Login): Promise<string> {
  const { rows } = await fixture
    .db()
    .query<{ user_id: string }>(
      "SELECT user_id FROM app.session WHERE refresh_token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')",
      [decodeURIComponent(login.cookie.split('=')[1] ?? '')],
    );
  return rows[0]?.user_id ?? '';
}

describe('Admin password step and lockout (AD-01)', () => {
  const fixture = useApp();
  const { db } = fixture;
  const { newAdmin, password } = adminCalls(fixture);

  it('AD-01 unknown email, wrong password and disabled account get one answer', async () => {
    const email = `a-${String(Date.now())}@heach.invalid`;
    await newAdmin(email);
    const wrong = await password(email, 'not-the-password').expect(401);
    const unknown = await password(`nobody-${String(Date.now())}@heach.invalid`).expect(401);
    await db().query("UPDATE app.admin_account SET status = 'disabled' WHERE email = $1", [email]);
    const disabled = await password(email).expect(401);
    for (const response of [wrong, unknown, disabled]) {
      expect(response.body).toMatchObject({ code: 'invalid_credentials' });
    }
  });

  it('AD-01 five wrong passwords lock the account, even against the right one', async () => {
    const email = `lock-${String(Date.now())}@heach.invalid`;
    await newAdmin(email);
    for (let i = 0; i < 5; i += 1) await password(email, 'wrong-password-x').expect(401);
    await password(email).expect(401);
    const { rows } = await db().query("SELECT 1 FROM audit.entry WHERE action = 'admin.locked'");
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Admin TOTP enrolment and tickets (AD-01, EN-03)', () => {
  const fixture = useApp();
  const { app, db, server } = fixture;
  const { newAdmin, password } = adminCalls(fixture);

  it('AD-01 the password alone never signs in; the first code enrols TOTP', async () => {
    const email = `mfa-${String(Date.now())}@heach.invalid`;
    await newAdmin(email);
    const first = await password(email).expect(200);
    const { mfaTicket, enrolment } = first.body as {
      mfaTicket: string;
      enrolment: { secret: string; uri: string };
    };
    expect(first.headers['set-cookie']).toBeUndefined();
    expect(enrolment.uri).toContain(`secret=${enrolment.secret}`);
    await server().post('/admin/v1/auth/mfa').send({ mfaTicket, code: '000000' }).expect(401);
    const signedIn = await server()
      .post('/admin/v1/auth/mfa')
      .send({ mfaTicket, code: totpAt(enrolment.secret, stepAt(Date.now())) })
      .expect(200);
    expect(String(signedIn.headers['set-cookie'])).toMatch(
      /heach_admin_refresh=.*Path=\/api\/admin\/v1\/auth/,
    );
    // The ticket is single use; later sign-ins show no secret.
    await server()
      .post('/admin/v1/auth/mfa')
      .send({ mfaTicket, code: nextTotp(enrolment.secret) })
      .expect(401);
    const later = await password(email).expect(200);
    expect((later.body as { enrolment?: unknown }).enrolment).toBeUndefined();
    // A code's time step works once: the same code fails on the new ticket.
    const reused = await server()
      .post('/admin/v1/auth/mfa')
      .send({
        mfaTicket: (later.body as { mfaTicket: string }).mfaTicket,
        code: totpAt(enrolment.secret, stepAt(Date.now())),
      });
    expect(reused.status).toBe(401);
  });

  it('AD-01 five wrong codes close the ticket', async () => {
    const email = `ticket-${String(Date.now())}@heach.invalid`;
    await newAdmin(email);
    const { mfaTicket, enrolment } = (await password(email).expect(200)).body as {
      mfaTicket: string;
      enrolment: { secret: string };
    };
    for (let i = 0; i < 5; i += 1) {
      await server().post('/admin/v1/auth/mfa').send({ mfaTicket, code: '000000' }).expect(401);
    }
    const late = await server()
      .post('/admin/v1/auth/mfa')
      .send({ mfaTicket, code: totpAt(enrolment.secret, stepAt(Date.now())) })
      .expect(401);
    expect(late.body).toMatchObject({ code: 'mfa_expired' });
  });

  it('EN-03 the TOTP secret is ciphertext; the password is a scrypt hash', async () => {
    const admin = await adminSignIn(app(), 'finance');
    const { rows } = await db().query<{ secret: string; hash: string }>(
      'SELECT totp_secret::text AS secret, password_hash AS hash FROM app.admin_account WHERE id = $1',
      [admin.id],
    );
    expect(rows[0]?.secret).toContain('ciphertext');
    expect(rows[0]?.secret).not.toContain(admin.secret);
    expect(rows[0]?.hash).toMatch(/^scrypt\$/);
  });
});

describe('Admin sessions (SE-04)', () => {
  const fixture = useApp();
  const { app, server } = fixture;

  it('SE-04 admin refresh rotates on its own cookie path; sign-out ends it', async () => {
    const admin = await adminSignIn(app(), 'support');
    const refreshed = await server()
      .post('/admin/v1/auth/refresh')
      .set('Cookie', admin.cookie)
      .expect(200);
    const next = fromResponse(refreshed);
    await server().get('/admin/v1/me').set(bearer(next)).expect(200);
    // A patient's refresh route does not take an admin cookie, and the other way round.
    await server().post('/v1/auth/refresh').set('Cookie', admin.cookie).expect(401);
    await server()
      .post('/admin/v1/auth/logout')
      .set(bearer(next))
      .send({ allDevices: false })
      .expect(204);
    const after = await server().post('/admin/v1/auth/refresh').set('Cookie', next.cookie);
    expect(after.status).toBe(401);
  });
});

describe('Admin sub-role matrix (AD-01, SE-02.2)', () => {
  const { app, db, server } = useApp();

  type Caller = 'super_admin' | 'verifier' | 'support' | 'finance' | 'patient' | 'anonymous';
  const callers: Caller[] = [
    'super_admin',
    'verifier',
    'support',
    'finance',
    'patient',
    'anonymous',
  ];
  const signIn = async (caller: Caller): Promise<Login | undefined> => {
    if (caller === 'anonymous') return undefined;
    if (caller === 'patient') return (await signedUp(app())).login;
    return adminSignIn(app(), caller);
  };

  const MATRIX: {
    route: string;
    call: (target: string) => request.Test;
    expect: Record<Caller, number>;
  }[] = [
    {
      route: 'GET /admin/v1/me',
      call: () => server().get('/admin/v1/me'),
      expect: {
        super_admin: 200,
        verifier: 200,
        support: 200,
        finance: 200,
        patient: 403,
        anonymous: 401,
      },
    },
    {
      route: 'GET /admin/v1/users',
      call: () => server().get('/admin/v1/users'),
      expect: {
        super_admin: 200,
        verifier: 200,
        support: 200,
        finance: 403,
        patient: 403,
        anonymous: 401,
      },
    },
    {
      route: 'GET /admin/v1/users/:id',
      call: (id) => server().get(`/admin/v1/users/${id}`),
      expect: {
        super_admin: 200,
        verifier: 200,
        support: 200,
        finance: 403,
        patient: 403,
        anonymous: 401,
      },
    },
    {
      // Allowed sub-roles still need a fresh TOTP code first (decision L-11).
      route: 'POST /admin/v1/users/:id/suspend',
      call: (id) => server().post(`/admin/v1/users/${id}/suspend`).send({ reason: 'other' }),
      expect: {
        super_admin: 403,
        verifier: 403,
        support: 403,
        finance: 403,
        patient: 403,
        anonymous: 401,
      },
    },
    {
      route: 'GET /v1/me',
      call: () => server().get('/v1/me'),
      expect: {
        super_admin: 403,
        verifier: 403,
        support: 403,
        finance: 403,
        patient: 200,
        anonymous: 401,
      },
    },
  ];

  for (const row of MATRIX) {
    for (const caller of callers) {
      it(`SE-02.2 ${row.route} as ${caller} returns ${String(row.expect[caller])}`, async () => {
        const target = (await signedUp(app())).login;
        const { rows } = await db().query<{ user_id: string }>(
          'SELECT user_id FROM app.session ORDER BY created_at DESC LIMIT 1',
        );
        const session = await signIn(caller);
        const test = row.call(rows[0]?.user_id ?? '');
        if (session) void test.set(bearer(session));
        expect((await test).status).toBe(row.expect[caller]);
        expect(target.token).toBeTruthy();
      });
    }
  }
});

describe('Admin user management (AD-01, AD-03, SE-05)', () => {
  const fixture = useApp();
  const { app, db, server } = fixture;
  const output = captureOutput();

  afterAll(() => {
    output.stop();
  });

  it('AD-01 lists show masked names and numbers; the detail read is audited', async () => {
    const { mobile, login } = await signedUp(app(), { fullName: 'Synthetic Masked Person' });
    const id = await userId(fixture, login);
    const admin = await adminSignIn(app(), 'verifier');
    const list = await server()
      .get('/admin/v1/users')
      .query({ q: mobile.slice(3) })
      .set(bearer(admin))
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      items: [
        {
          id,
          name: 'S•••••••• M••••• P•••••',
          mobile: `••••••${mobile.slice(-4)}`,
          status: 'active',
        },
      ],
    });
    expect(JSON.stringify(list.body)).not.toContain('Synthetic Masked');
    const byName = await server()
      .get('/admin/v1/users')
      .query({ q: 'masked per' })
      .set(bearer(admin))
      .expect(200);
    expect((byName.body as { items: { id: string }[] }).items.map((item) => item.id)).toContain(id);
    const detail = await server().get(`/admin/v1/users/${id}`).set(bearer(admin)).expect(200);
    expect(detail.body).toMatchObject({ fullName: 'Synthetic Masked Person' });
    expect(detail.headers['cache-control']).toBe('no-store');
    const { rows } = await db().query(
      "SELECT actor_role FROM audit.entry WHERE action = 'admin.user.view' AND entity_id = $1",
      [id],
    );
    expect(rows).toEqual([{ actor_role: 'verifier' }]);
    expect(output.text()).not.toContain(mobile.slice(3));
  });
});

describe('Admin suspend and reinstate (AD-03, SE-05)', () => {
  const fixture = useApp();
  const { app, db, server } = fixture;

  it('AD-03 support suspends after a fresh TOTP: every device is signed out and sign-in refused', async () => {
    const { mobile, login } = await signedUp(app());
    const id = await userId(fixture, login);
    const support = await adminSignIn(app(), 'support');
    const suspend = () =>
      server()
        .post(`/admin/v1/users/${id}/suspend`)
        .set(bearer(support))
        .send({ reason: 'safety_concern' });
    expect((await suspend().expect(403)).body).toMatchObject({ code: 'reverification_required' });
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(support))
      .send({ code: '000000' })
      .expect(401);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(support))
      .send({ code: nextTotp(support.secret) })
      .expect(204);
    await suspend().expect(204);
    await suspend().expect(409);
    await server().get('/v1/me').set(bearer(login)).expect(401);
    await server().post('/v1/auth/refresh').set('Cookie', login.cookie).expect(401);
    const again = await server().post('/v1/auth/otp').send({ mobile, locale: 'en' }).expect(200);
    expect(again.status).toBe(200);
    const { rows } = await db().query<{ actor_role: string }>(
      "SELECT actor_role FROM audit.entry WHERE action = 'admin.user.suspended' AND entity_id = $1",
      [id],
    );
    expect(rows).toEqual([{ actor_role: 'support' }]);
    await server().post(`/admin/v1/users/${id}/reinstate`).set(bearer(support)).expect(204);
    const back = await otpSignIn(app(), mobile);
    await server().get('/v1/me').set(bearer(back.login)).expect(200);
  });

  it('AD-03 a verifier may look but not suspend, even after a fresh code', async () => {
    const { login } = await signedUp(app());
    const id = await userId(fixture, login);
    const verifier = await adminSignIn(app(), 'verifier');
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(verifier))
      .send({ code: nextTotp(verifier.secret) })
      .expect(204);
    const refused = await server()
      .post(`/admin/v1/users/${id}/suspend`)
      .set(bearer(verifier))
      .send({ reason: 'other' });
    expect(refused.status).toBe(403);
  });

  it('SE-02 an unknown or malformed user ID reveals nothing', async () => {
    const admin = await adminSignIn(app(), 'super_admin');
    const unknown = await server()
      .get('/admin/v1/users/00000000-0000-4000-8000-00000000abcd')
      .set(bearer(admin));
    const malformed = await server().get('/admin/v1/users/not-a-uuid').set(bearer(admin));
    expect([unknown.status, malformed.status]).toEqual([404, 400]);
  });
});
