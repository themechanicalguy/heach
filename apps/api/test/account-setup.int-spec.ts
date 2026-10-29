import type request from 'supertest';
import {
  CURRENT_CONSENTS,
  otpSignIn,
  reverify,
  signedUp,
  statusesOf,
  useApp,
} from './account-helpers.js';
import { bearer, fromResponse, type Login } from './auth-helpers.js';

const withToken = (login: Login, response: request.Response): Login => ({
  ...login,
  token: (response.body as { accessToken: string }).accessToken,
});

/** The calls every block uses, bound to that block's app. */
function setupCalls(server: ReturnType<typeof useApp>['server']) {
  const me = async (login: Login) =>
    (await server().get('/v1/me').set(bearer(login))).body as Record<string, unknown>;
  const save = (login: Login, body: object) =>
    server().put('/v1/me/setup').set(bearer(login)).send(body);
  const complete = (login: Login, consents: object[] = CURRENT_CONSENTS) =>
    server().post('/v1/me/setup/complete').set(bearer(login)).send({ consents });
  return { me, save, complete };
}

describe('Account setup: save, resume and validation (PO-03, L-3)', () => {
  const { app, server } = useApp();
  const { me, save, complete } = setupCalls(server);

  it('PO-03 setup is saved step by step and resumes where it stopped', async () => {
    const { login } = await otpSignIn(app());
    await save(login, { role: 'nurse' }).expect(204);
    await save(login, { fullName: 'ସୀତା ସାହୁ', gender: 'female' }).expect(204);
    expect(await me(login)).toMatchObject({
      setup: {
        complete: false,
        nextStep: 'details',
        draft: {
          role: 'nurse',
          fullName: 'ସୀତା ସାହୁ',
          gender: 'female',
          languages: [],
          adultDeclared: false,
        },
      },
    });
    await save(login, { languages: ['or', 'hi'], adultDeclared: true }).expect(204);
    expect(await me(login)).toMatchObject({ setup: { nextStep: 'consent' } });
  });

  it('L-3 registration may ask only for a self-registrable role; nothing else is accepted', async () => {
    const { login } = await otpSignIn(app());
    for (const body of [
      { role: 'clinic_front_desk' },
      { role: 'super_admin' },
      { role: 'new_account' },
      { roles: ['patient'] },
      { applicationStatus: 'approved' },
      { fullName: '<script>' },
      { fullName: 'x'.repeat(101) },
      { languages: ['fr'] },
    ]) {
      await save(login, body).expect(400);
    }
    expect(await me(login)).toMatchObject({ roles: [], setup: { draft: { role: null } } });
  });

  it('PO-03 setup cannot finish with details missing, or with an outdated consent text', async () => {
    const { login } = await otpSignIn(app());
    await save(login, {
      role: 'lab',
      fullName: 'Synthetic Signatory',
      gender: 'male',
      adultDeclared: true,
      languages: ['en'],
    });
    expect((await complete(login).expect(400)).body).toMatchObject({ code: 'setup_incomplete' });
    await save(login, { organisationName: 'Synthetic Lab' }).expect(204);
    const outdated = [{ purpose: 'terms', version: '2020-01' }, ...CURRENT_CONSENTS.slice(1)];
    expect((await complete(login, outdated).expect(409)).body).toMatchObject({
      code: 'consent_outdated',
    });
    expect((await complete(login, CURRENT_CONSENTS.slice(0, 1)).expect(409)).body).toMatchObject({
      code: 'consent_outdated',
    });
  });
});

describe('Account setup: completion and grants (AC-04, PO-04, PR-01)', () => {
  const { app, db, server } = useApp();
  const { me, save, complete } = setupCalls(server);

  it('AC-04 a patient finishes setup: role granted by the server, consents recorded, setup closed', async () => {
    const { login } = await otpSignIn(app());
    await save(login, {
      role: 'patient',
      fullName: 'Synthetic Patient',
      gender: 'other',
      adultDeclared: true,
    });
    const done = await complete(login).expect(200);
    const session = withToken(login, done);
    expect(await me(session)).toMatchObject({
      activeRole: 'patient',
      roles: [{ role: 'patient', side: 'care', applicationStatus: null }],
      setup: { complete: true, nextStep: null },
      consentsDue: [],
    });
    // The old token stopped working, and setup routes are closed to the granted role.
    await server().get('/v1/me').set(bearer(login)).expect(401);
    await save(session, { role: 'nurse' }).expect(403);
    await complete(session).expect(403);
  });

  it('PO-04 a provider starts with a draft application', async () => {
    const { login } = await signedUp(app(), { role: 'physiotherapist', languages: ['or'] });
    expect(await me(login)).toMatchObject({
      activeRole: 'physiotherapist',
      roles: [{ role: 'physiotherapist', side: 'provider', applicationStatus: 'draft' }],
    });
  });

  it('PO-03 a repeated or concurrent completion grants the role once', async () => {
    const { login } = await otpSignIn(app());
    await save(login, {
      role: 'representative',
      fullName: 'Synthetic Carer',
      gender: 'male',
      adultDeclared: true,
    });
    const results = await Promise.all([complete(login), complete(login)]);
    // The loser is refused: 409 under the lock, or 401 if the winner already replaced the token.
    const statuses = statusesOf(results);
    expect(statuses[0]).toBe(200);
    expect([401, 409]).toContain(statuses[1]);
    const { rows } = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.consent_record c
         JOIN app.role_assignment r ON r.account_id = c.account_id WHERE r.role = 'representative'
          AND c.account_id = (SELECT account_id FROM app.role_assignment WHERE role = 'representative' ORDER BY granted_at DESC LIMIT 1)`,
    );
    expect(rows[0]?.n).toBe(2);
  });
});

describe('Consent versions and language (PR-01, AC-02)', () => {
  const { app, db, server } = useApp();
  const { me } = setupCalls(server);

  it('PR-01 a newer consent text is due again until accepted', async () => {
    const { login } = await signedUp(app());
    await db().query(
      `UPDATE app.consent_record SET withdrawn_at = now()
        WHERE account_id = (SELECT account_id FROM app.consent_record ORDER BY given_at DESC LIMIT 1)
          AND purpose = 'privacy'`,
    );
    expect(await me(login)).toMatchObject({ consentsDue: [{ purpose: 'privacy' }] });
    await server()
      .post('/v1/me/consents')
      .set(bearer(login))
      .send({ consents: CURRENT_CONSENTS })
      .expect(204);
    expect(await me(login)).toMatchObject({ consentsDue: [] });
  });

  it('AC-02 the language can be changed at any time and is kept on the account', async () => {
    const { login } = await otpSignIn(app());
    await server().put('/v1/me/locale').set(bearer(login)).send({ locale: 'hi' }).expect(204);
    expect(await me(login)).toMatchObject({ locale: 'hi' });
    await server().put('/v1/me/locale').set(bearer(login)).send({ locale: 'fr' }).expect(400);
  });
});

describe('Role switching and re-verification (L-3, AC-05)', () => {
  const { app, db, server } = useApp();
  const { me } = setupCalls(server);

  it('L-3 switching to a role the account does not hold is refused and audited', async () => {
    const { login } = await signedUp(app());
    const denied = await server()
      .post('/v1/auth/switch-role')
      .set(bearer(login))
      .send({ role: 'nurse' })
      .expect(403);
    expect(denied.body).toMatchObject({ code: 'role_not_granted' });
    await server()
      .post('/v1/auth/switch-role')
      .set(bearer(login))
      .send({ role: 'super_admin' })
      .expect(400);
    const { rows } = await db().query(
      "SELECT 1 FROM audit.entry WHERE action = 'account.role.switch.denied'",
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('AC-05 adding the provider side needs a fresh OTP; then the user can switch and refresh keeps the role', async () => {
    const { mobile, login } = await signedUp(app());
    const add = { role: 'nurse', languages: ['or'] };
    const blocked = await server().post('/v1/me/roles').set(bearer(login)).send(add).expect(403);
    expect(blocked.body).toMatchObject({ code: 'reverification_required' });
    await reverify(app(), mobile, login);
    await server().post('/v1/me/roles').set(bearer(login)).send(add).expect(204);
    // A second provider role is refused as the side already taken; an offered role is used so
    // the deferred-role check (ADR 0015) cannot answer first.
    const second = await server()
      .post('/v1/me/roles')
      .set(bearer(login))
      .send({ role: 'physiotherapist', languages: ['en'] })
      .expect(409);
    expect(second.body).toMatchObject({ code: 'side_taken' });
    const switched = await server()
      .post('/v1/auth/switch-role')
      .set(bearer(login))
      .send({ role: 'nurse' })
      .expect(200);
    const nurse = withToken(login, switched);
    expect(await me(nurse)).toMatchObject({ activeRole: 'nurse' });
    const refreshed = await server()
      .post('/v1/auth/refresh')
      .set('Cookie', login.cookie)
      .expect(200);
    expect(await me(fromResponse(refreshed))).toMatchObject({ activeRole: 'nurse' });
    // The next sign-in starts in the role used last (AC-05).
    const again = await otpSignIn(app(), mobile);
    expect(await me(again.login)).toMatchObject({ activeRole: 'nurse' });
  });

  it('AC-05 a wrong re-verification code unlocks nothing', async () => {
    const { login } = await signedUp(app());
    const started = await server().post('/v1/auth/reverify').set(bearer(login)).expect(200);
    await server()
      .post('/v1/auth/reverify/verify')
      .set(bearer(login))
      .send({ challengeId: (started.body as { challengeId: string }).challengeId, code: '000000' })
      .expect(400);
    const add = await server()
      .post('/v1/me/roles')
      .set(bearer(login))
      .send({ role: 'nurse', languages: ['or'] });
    expect(add.body).toMatchObject({ code: 'reverification_required' });
  });

  it("SE-02 a re-verification code is bound to its own account: another user's code is refused", async () => {
    const first = await signedUp(app());
    const second = await signedUp(app());
    const started = await server().post('/v1/auth/reverify').set(bearer(first.login)).expect(200);
    const challengeId = (started.body as { challengeId: string }).challengeId;
    const crossed = await server()
      .post('/v1/auth/reverify/verify')
      .set(bearer(second.login))
      .send({ challengeId, code: '123456' });
    expect(crossed.body).toMatchObject({ code: 'otp_expired' });
  });
});

describe('Role removal and accounts in setup (L-10, SE-02)', () => {
  const { app, db, server } = useApp();

  it('L-10 a role removed on the server ends the session at the next refresh', async () => {
    const { login } = await signedUp(app());
    await db().query(
      `DELETE FROM app.role_assignment WHERE account_id = (SELECT user_id FROM app.session ORDER BY created_at DESC LIMIT 1)`,
    );
    expect((await server().post('/v1/auth/refresh').set('Cookie', login.cookie)).status).toBe(401);
  });

  it('SE-02 a new account may not use patient routes before setup grants a role', async () => {
    const { login } = await otpSignIn(app());
    const notes = await server().get('/v1/sample/notes').set(bearer(login));
    const consents = await server()
      .post('/v1/me/consents')
      .set(bearer(login))
      .send({ consents: CURRENT_CONSENTS });
    expect([notes.status, consents.status]).toEqual([403, 403]);
  });
});
