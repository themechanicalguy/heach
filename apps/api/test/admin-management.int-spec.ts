import { randomUUID } from 'node:crypto';
import { stepAt, totpAt } from '../src/admin/totp.js';
import {
  ADMIN_PASSWORD,
  adminSignIn,
  nextTotp,
  useApp,
  type AdminLogin,
} from './account-helpers.js';
import { bearer, fromResponse } from './auth-helpers.js';
import { captureOutput } from './capture-output.js';

const NEW_PASSWORD = 'a-new-synthetic-passphrase';

/** The calls every block uses, bound to that block's app. */
function managementCalls({ app, server }: ReturnType<typeof useApp>) {
  /** A super admin who has proved a fresh TOTP code, ready to manage admins. */
  async function superAdmin(): Promise<AdminLogin> {
    const admin = await adminSignIn(app(), 'super_admin');
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    return admin;
  }

  const create = (admin: AdminLogin, role: string, email = `new-${randomUUID()}@heach.invalid`) =>
    server().post('/admin/v1/admins').set(bearer(admin)).send({ email, role });

  /** Password, then TOTP enrolment; returns the ticket step's answer. */
  async function firstSignIn(email: string, password: string, newPassword?: string) {
    const step = await server()
      .post('/admin/v1/auth/password')
      .send({ email, password })
      .expect(200);
    const body = step.body as {
      mfaTicket: string;
      enrolment?: { secret: string };
      passwordChangeRequired: boolean;
    };
    const secret = body.enrolment?.secret ?? '';
    const mfa = await server()
      .post('/admin/v1/auth/mfa')
      .send({ mfaTicket: body.mfaTicket, code: totpAt(secret, stepAt(Date.now())), newPassword });
    return { body, mfa, secret };
  }
  return { superAdmin, create, firstSignIn };
}

describe('Admin accounts: who may manage, and first sign-in (AD-01, O-2)', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { superAdmin, create, firstSignIn } = managementCalls(context);

  it('AD-01 only a super admin may list or manage admins', async () => {
    for (const role of ['verifier', 'support', 'finance'] as const) {
      const admin = await adminSignIn(app(), role);
      await server().get('/admin/v1/admins').set(bearer(admin)).expect(403);
      await create(admin, 'support').expect(403);
    }
    const admin = await adminSignIn(app(), 'super_admin');
    await server().get('/admin/v1/admins').set(bearer(admin)).expect(200);
    await create(admin, 'support').expect(403);
  });

  it('O-2 a new admin gets a temporary password that must be replaced at first sign-in', async () => {
    const admin = await superAdmin();
    const email = `fresh-${randomUUID()}@heach.invalid`;
    const created = await create(admin, 'verifier', email).expect(201);
    expect(created.headers['cache-control']).toBe('no-store');
    const { temporaryPassword } = created.body as { temporaryPassword: string };

    const withoutNew = await firstSignIn(email, temporaryPassword);
    expect(withoutNew.body.passwordChangeRequired).toBe(true);
    expect(withoutNew.mfa.status).toBe(401);
    expect(withoutNew.mfa.body).toMatchObject({ code: 'password_change_required' });
    expect((await firstSignIn(email, temporaryPassword, 'short')).mfa.body).toMatchObject({
      code: 'password_too_short',
    });
    expect((await firstSignIn(email, temporaryPassword, temporaryPassword)).mfa.body).toMatchObject(
      {
        code: 'password_reused',
      },
    );
    const done = await firstSignIn(email, temporaryPassword, NEW_PASSWORD);
    expect(done.mfa.status).toBe(200);
    const me = await server()
      .get('/admin/v1/me')
      .set(bearer(fromResponse(done.mfa)))
      .expect(200);
    expect(me.body).toMatchObject({ email, role: 'verifier' });
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: temporaryPassword })
      .expect(401);
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: NEW_PASSWORD })
      .expect(200);
  });

  it('O-2 a temporary password stops working after it expires, used or not', async () => {
    const admin = await superAdmin();
    const email = `stale-${randomUUID()}@heach.invalid`;
    const { temporaryPassword } = (await create(admin, 'support', email).expect(201)).body as {
      temporaryPassword: string;
    };
    await db().query(
      `UPDATE app.admin_account SET password_expires_at = now() - interval '1 minute'
        WHERE email = $1`,
      [email],
    );
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: temporaryPassword })
      .expect(401);
  });

  it('O-2 managing needs a fresh TOTP; an admin can never change their own account here', async () => {
    const admin = await adminSignIn(app(), 'super_admin');
    await create(admin, 'support').expect(403);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    const own = `/admin/v1/admins/${admin.id}`;
    for (const call of [
      () => server().put(`${own}/role`).send({ role: 'verifier' }),
      () => server().put(`${own}/status`).send({ status: 'disabled' }),
      () => server().post(`${own}/password-reset`),
      () => server().post(`${own}/mfa-reset`),
    ]) {
      const response = await call().set(bearer(admin));
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'self_change_refused' });
    }
  });
});

describe('Admin accounts: sub-role, status and recovery (O-2)', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { superAdmin } = managementCalls(context);

  it('O-2 a sub-role change takes effect at once: the old tokens stop working', async () => {
    const admin = await superAdmin();
    const target = await adminSignIn(app(), 'support');
    await server().get('/admin/v1/users').set(bearer(target)).expect(200);
    await server()
      .put(`/admin/v1/admins/${target.id}/role`)
      .set(bearer(admin))
      .send({ role: 'finance' })
      .expect(204);
    await server().get('/admin/v1/me').set(bearer(target)).expect(401);
    await server().post('/admin/v1/auth/refresh').set('Cookie', target.cookie).expect(401);
    const { rows } = await db().query<{ role: string }>(
      'SELECT role FROM app.admin_account WHERE id = $1',
      [target.id],
    );
    expect(rows[0]?.role).toBe('finance');
  });

  it('O-2 a disabled admin cannot sign in until enabled again', async () => {
    const admin = await superAdmin();
    const target = await adminSignIn(app(), 'verifier');
    const { rows } = await db().query<{ email: string }>(
      'SELECT email FROM app.admin_account WHERE id = $1',
      [target.id],
    );
    const email = rows[0]?.email ?? '';
    const status = (value: string) =>
      server()
        .put(`/admin/v1/admins/${target.id}/status`)
        .set(bearer(admin))
        .send({ status: value });
    await status('disabled').expect(204);
    await server().get('/admin/v1/me').set(bearer(target)).expect(401);
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: ADMIN_PASSWORD })
      .expect(401);
    await status('disabled').expect(409);
    await status('active').expect(204);
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: ADMIN_PASSWORD })
      .expect(200);
  });

  it('O-2 a password reset replaces the password and ends every session; MFA reset re-enrols', async () => {
    const admin = await superAdmin();
    const target = await adminSignIn(app(), 'support');
    const { rows } = await db().query<{ email: string }>(
      'SELECT email FROM app.admin_account WHERE id = $1',
      [target.id],
    );
    const email = rows[0]?.email ?? '';
    const output = captureOutput();
    let temporaryPassword: string;
    try {
      const reset = await server()
        .post(`/admin/v1/admins/${target.id}/password-reset`)
        .set(bearer(admin))
        .expect(200);
      temporaryPassword = (reset.body as { temporaryPassword: string }).temporaryPassword;
    } finally {
      output.stop();
    }
    expect(output.text()).not.toContain(temporaryPassword);
    await server().get('/admin/v1/me').set(bearer(target)).expect(401);
    await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: ADMIN_PASSWORD })
      .expect(401);
    const signIn = await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: temporaryPassword })
      .expect(200);
    expect(signIn.body).toMatchObject({ passwordChangeRequired: true });
    expect(signIn.body).not.toHaveProperty('enrolment');

    await server().post(`/admin/v1/admins/${target.id}/mfa-reset`).set(bearer(admin)).expect(204);
    const again = await server()
      .post('/admin/v1/auth/password')
      .send({ email, password: temporaryPassword })
      .expect(200);
    expect(again.body).toHaveProperty('enrolment.secret');

    const { rows: entries } = await db().query<{ detail: string }>(
      `SELECT row_to_json(e)::text AS detail FROM audit.entry e
        WHERE entity = 'admin_account' AND entity_id = $1`,
      [target.id],
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.detail).not.toContain(temporaryPassword);
  });
});

describe('Admin accounts: last super admin and own password (O-2)', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { superAdmin } = managementCalls(context);

  it('O-2 two super admins demoting each other at once leave one super admin', async () => {
    const first = await superAdmin();
    const second = await superAdmin();
    await db().query(
      `UPDATE app.admin_account SET status = 'disabled'
        WHERE role = 'super_admin' AND id NOT IN ($1, $2)`,
      [first.id, second.id],
    );
    const demote = (actor: AdminLogin, target: AdminLogin) =>
      server()
        .put(`/admin/v1/admins/${target.id}/role`)
        .set(bearer(actor))
        .send({ role: 'support' });
    const results = await Promise.all([demote(first, second), demote(second, first)]);
    expect(results.filter((response) => response.status === 204)).toHaveLength(1);
    const { rows } = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.admin_account
        WHERE role = 'super_admin' AND status = 'active'`,
    );
    expect(rows[0]?.n).toBe(1);
  });

  it('O-2 an admin changes their own password with the current one and a fresh TOTP', async () => {
    const admin = await adminSignIn(app(), 'verifier');
    const change = (currentPassword: string) =>
      server()
        .post('/admin/v1/auth/password/change')
        .set(bearer(admin))
        .send({ currentPassword, newPassword: NEW_PASSWORD });
    await change(ADMIN_PASSWORD).expect(403);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    await change('not-the-password').expect(401);
    await change(ADMIN_PASSWORD).expect(204);
    await server().get('/admin/v1/me').set(bearer(admin)).expect(200);
  });
});
