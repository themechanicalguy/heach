import { randomUUID } from 'node:crypto';
import { OtpService } from '../src/otp/otp.service.js';
import {
  adminSignIn,
  type AdminLogin,
  signedUp,
  sms,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import {
  adminReverify,
  ASSISTED,
  openAssisted,
  requestConsent,
  verifyConsent,
} from './assisted-helpers.js';
import { bearer } from './auth-helpers.js';
import { accountIdOf } from './provider-helpers.js';

interface Challenge {
  sessionId: string;
  mobile: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}

/** The calls every block uses, bound to that block's app. */
function assistedCalls(context: ReturnType<typeof useApp>) {
  const { app, db } = context;
  const support = async (): Promise<AdminLogin> => adminSignIn(app(), 'support');
  const sessionRow = async (sessionId: string) =>
    (
      await db().query<{
        account_id: string | null;
        ended_at: Date | null;
        end_reason: string | null;
      }>('SELECT account_id, ended_at, end_reason FROM app.assisted_session WHERE id = $1', [
        sessionId,
      ])
    ).rows[0];
  const accountCount = async (mobile: string) =>
    (
      await db().query<{ count: string }>(
        'SELECT count(*) FROM app.account WHERE mobile_index = $1',
        [app().get(OtpService).mobileIndex(mobile)],
      )
    ).rows[0]?.count;
  const audited = async (action: string, sessionId: string) =>
    (
      await db().query<{ actor_id: string; actor_role: string; entity: string }>(
        'SELECT actor_id, actor_role, entity FROM audit.entry WHERE action = $1 AND entity_id = $2',
        [action, sessionId],
      )
    ).rows;
  return { support, sessionRow, accountCount, audited };
}

describe('AD-12 consent code opens a session', () => {
  const context = useApp();
  const { app, server } = context;
  const { support, sessionRow, accountCount, audited } = assistedCalls(context);

  it('AD-12 the account exists only after the code is verified; the SMS is the consent template', async () => {
    const admin = await support();
    const mobile = syntheticMobile();
    await adminReverify(app(), admin);
    const requested = await requestConsent(app(), admin, mobile, 'hi').expect(200);
    const challenge = requested.body as Challenge;
    expect(requested.headers['cache-control']).toBe('no-store');
    expect(Object.keys(challenge)).toEqual([
      'sessionId',
      'mobile',
      'expiresInSeconds',
      'resendInSeconds',
    ]);
    expect(challenge.mobile).toBe(`••••••${mobile.slice(-4)}`);
    expect(JSON.stringify(challenge)).not.toContain(mobile.slice(-10));
    expect(sms(app()).sent.findLast((m) => m.to === mobile)).toMatchObject({
      templateId: 'otp_assisted_consent',
      locale: 'hi',
    });
    expect(await accountCount(mobile)).toBe('0');
    expect(await audited('onboarding.assisted.consent_requested', challenge.sessionId)).toEqual([
      { actor_id: admin.id, actor_role: 'support', entity: 'assisted_session' },
    ]);

    const opened = await verifyConsent(
      app(),
      admin,
      challenge.sessionId,
      sms(app()).lastCodeFor(mobile),
    ).expect(200);
    expect(opened.body).toMatchObject({
      sessionId: challenge.sessionId,
      mobile: challenge.mobile,
      maskedName: null,
      ended: false,
      accountCreated: true,
      setupComplete: false,
      basicDetailsLocked: false,
      payoutCodeSent: false,
      application: null,
    });
    expect(JSON.stringify(opened.body)).not.toContain(mobile.slice(-10));
    expect(await accountCount(mobile)).toBe('1');
    expect((await sessionRow(challenge.sessionId))?.account_id).toBeTruthy();
    const log = await audited('onboarding.assisted.session_opened', challenge.sessionId);
    expect(log).toHaveLength(1);
    const current = await server()
      .get(`${ASSISTED}/sessions/current`)
      .set(bearer(admin))
      .expect(200);
    expect(current.body).toMatchObject({ sessionId: challenge.sessionId });
  });

  it('AD-12 an existing patient keeps their name, shown masked, and is not re-created', async () => {
    const { mobile, login } = await signedUp(app());
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin, mobile);
    const view = await server()
      .get(`${ASSISTED}/sessions/${sessionId}`)
      .set(bearer(admin))
      .expect(200);
    expect(view.body).toMatchObject({
      accountCreated: false,
      setupComplete: true,
      basicDetailsLocked: true,
      maskedName: 'S•••••••• P•••••',
      application: null,
    });
    expect((await sessionRow(sessionId))?.account_id).toBe(await accountIdOf(app(), login));
    expect(await accountCount(mobile)).toBe('1');
  });

  it('AD-12 ending a session is idempotent and shows the start screen again', async () => {
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin);
    await server().post(`${ASSISTED}/sessions/${sessionId}/end`).set(bearer(admin)).expect(204);
    await server().post(`${ASSISTED}/sessions/${sessionId}/end`).set(bearer(admin)).expect(204);
    await server().get(`${ASSISTED}/sessions/current`).set(bearer(admin)).expect(404);
    expect(await audited('onboarding.assisted.session_ended', sessionId)).toHaveLength(1);
    expect((await sessionRow(sessionId))?.end_reason).toBe('ended');
  });
});

describe('AD-12 who may call the assisted routes', () => {
  const context = useApp();
  const { app, server } = context;
  const sessionId = randomUUID();
  const calls = [
    ['post', '/consent', { mobile: '9000000001', locale: 'en' }],
    ['post', `/sessions/${sessionId}/consent/resend`, undefined],
    ['post', `/sessions/${sessionId}/consent/verify`, { code: '123456' }],
    ['get', '/sessions/current', undefined],
    ['get', `/sessions/${sessionId}`, undefined],
    ['post', `/sessions/${sessionId}/end`, undefined],
  ] as const;

  it('AD-12 verifier, finance and user tokens get 403 and anonymous callers 401 on every route', async () => {
    const outsiders = [
      await adminSignIn(app(), 'verifier'),
      await adminSignIn(app(), 'finance'),
      (await signedUp(app())).login,
    ];
    for (const [method, path, body] of calls) {
      for (const outsider of outsiders) {
        const call = server()[method](`${ASSISTED}${path}`).set(bearer(outsider));
        expect((await (body ? call.send(body) : call)).status).toBe(403);
      }
      const anonymous = server()[method](`${ASSISTED}${path}`);
      expect((await (body ? anonymous.send(body) : anonymous)).status).toBe(401);
    }
  });

  it('AD-12 super admin and support may call; a consent request needs a fresh TOTP code', async () => {
    for (const role of ['support', 'super_admin'] as const) {
      const admin = await adminSignIn(app(), role);
      const mobile = syntheticMobile();
      const stale = await requestConsent(app(), admin, mobile).expect(403);
      expect(stale.body).toMatchObject({ code: 'reverification_required' });
      expect(sms(app()).lastCodeFor(mobile)).toBeUndefined();
      await adminReverify(app(), admin);
      await requestConsent(app(), admin, mobile).expect(200);
    }
  });

  it('AD-12 a number that is not an Indian mobile is refused before any code is sent', async () => {
    const admin = await adminSignIn(app(), 'support');
    await adminReverify(app(), admin);
    const refused = await requestConsent(app(), admin, '12345').expect(400);
    expect(refused.body).toMatchObject({ code: 'mobile_invalid' });
  });
});

describe('AD-12 the consent code', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { support, sessionRow } = assistedCalls(context);

  async function pending(admin: AdminLogin, mobile = syntheticMobile()) {
    await adminReverify(app(), admin);
    const requested = await requestConsent(app(), admin, mobile).expect(200);
    return { mobile, sessionId: (requested.body as Challenge).sessionId };
  }
  const wrongCode = (mobile: string) =>
    sms(app()).lastCodeFor(mobile) === '000000' ? '111111' : '000000';

  it('AD-12 a wrong code is counted and the fifth ends the challenge', async () => {
    const admin = await support();
    const { mobile, sessionId } = await pending(admin);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await verifyConsent(app(), admin, sessionId, wrongCode(mobile)).expect(400);
      expect(wrong.body).toMatchObject({ code: 'otp_incorrect' });
    }
    const late = await verifyConsent(app(), admin, sessionId, sms(app()).lastCodeFor(mobile));
    expect(late.status).toBe(400);
    expect(late.body).toMatchObject({ code: 'otp_expired' });
    expect((await sessionRow(sessionId))?.account_id).toBeNull();
  });

  it('AD-12 a session that is already open cannot be verified a second time', async () => {
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin);
    const replay = await verifyConsent(app(), admin, sessionId, '123456');
    expect(replay.status).toBe(404);
  });

  it('AD-12 the consent challenge does not sign in, and a sign-in code cannot open a session', async () => {
    const admin = await support();
    const { mobile, sessionId } = await pending(admin);
    const challenge = await db().query<{ consent_challenge_id: string }>(
      'SELECT consent_challenge_id FROM app.assisted_session WHERE id = $1',
      [sessionId],
    );
    const signIn = await server()
      .post('/v1/auth/otp/verify')
      .send({
        challengeId: challenge.rows[0]?.consent_challenge_id,
        code: sms(app()).lastCodeFor(mobile),
        locale: 'en',
      })
      .expect(400);
    expect(signIn.body).toMatchObject({ code: 'otp_expired' });
    await server()
      .post('/v1/auth/otp')
      .send({ mobile: syntheticMobile(), locale: 'en' })
      .expect(200);
    const foreign = syntheticMobile();
    await server().post('/v1/auth/otp').send({ mobile: foreign, locale: 'en' }).expect(200);
    const mismatch = await verifyConsent(app(), admin, sessionId, sms(app()).lastCodeFor(foreign));
    expect(mismatch.status).toBe(400);
  });

  it('AD-12 a new code goes out only through the admin own pending session, after the cooldown', async () => {
    const admin = await support();
    const other = await support();
    const { mobile, sessionId } = await pending(admin);
    const resend = (as: AdminLogin) =>
      server().post(`${ASSISTED}/sessions/${sessionId}/consent/resend`).set(bearer(as));
    await resend(other).expect(404);
    await resend(admin).expect(429);
    await db().query(
      "UPDATE app.otp_challenge SET resend_at = now() - interval '1 second' WHERE id = (SELECT consent_challenge_id FROM app.assisted_session WHERE id = $1)",
      [sessionId],
    );
    const again = await resend(admin).expect(200);
    expect(again.body).toMatchObject({ sessionId, mobile: `••••••${mobile.slice(-4)}` });
    expect(
      sms(app())
        .sent.filter((m) => m.to === mobile)
        .map((m) => m.templateId),
    ).toEqual(['otp_assisted_consent', 'otp_assisted_consent']);
    await verifyConsent(app(), admin, sessionId, sms(app()).lastCodeFor(mobile)).expect(200);
    await resend(admin).expect(404);
  });
});

describe('AD-12 session lifetime and ownership', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { support } = assistedCalls(context);
  const paths = (id: string) =>
    [
      ['post', `/sessions/${id}/consent/resend`],
      ['post', `/sessions/${id}/consent/verify`],
      ['get', `/sessions/${id}`],
      ['post', `/sessions/${id}/end`],
    ] as const;

  it('AD-12 another admin gets 404 for a session on every session route', async () => {
    const owner = await support();
    const intruder = await support();
    const { sessionId } = await openAssisted(app(), owner);
    for (const [method, path] of paths(sessionId)) {
      const call = server()[method](`${ASSISTED}${path}`);
      const response = await call.set(bearer(intruder)).send({ code: '123456' });
      expect(response.status).toBe(404);
    }
    await server().get(`${ASSISTED}/sessions/current`).set(bearer(intruder)).expect(404);
  });

  it('AD-12 an expired, ended or suspended-account session answers 409 assisted_session_ended', async () => {
    const admin = await support();
    const expired = await openAssisted(app(), admin);
    await db().query(
      `UPDATE app.assisted_session
          SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [expired.sessionId],
    );
    const view = (id: string) => server().get(`${ASSISTED}/sessions/${id}`).set(bearer(admin));
    expect((await view(expired.sessionId).expect(409)).body).toMatchObject({
      code: 'assisted_session_ended',
    });
    await server().get(`${ASSISTED}/sessions/current`).set(bearer(admin)).expect(404);

    const ended = await openAssisted(app(), admin);
    await server()
      .post(`${ASSISTED}/sessions/${ended.sessionId}/end`)
      .set(bearer(admin))
      .expect(204);
    expect((await view(ended.sessionId).expect(409)).body).toMatchObject({
      code: 'assisted_session_ended',
    });

    const suspended = await openAssisted(app(), admin);
    await db().query(
      `UPDATE app.account SET status = 'suspended', suspension_reason = 'other'
        WHERE id = (SELECT account_id FROM app.assisted_session WHERE id = $1)`,
      [suspended.sessionId],
    );
    expect((await view(suspended.sessionId).expect(409)).body).toMatchObject({
      code: 'assisted_session_ended',
    });
    await server().get(`${ASSISTED}/sessions/current`).set(bearer(admin)).expect(404);
  });

  it('AD-12 a malformed session id is refused before any lookup', async () => {
    const admin = await support();
    await server().get(`${ASSISTED}/sessions/not-a-uuid`).set(bearer(admin)).expect(400);
  });
});

describe('AD-12 one open session at a time', () => {
  const context = useApp();
  const { app, server } = context;
  const { support, sessionRow } = assistedCalls(context);

  it('AD-12 an admin with an open session cannot ask for another consent until it ends', async () => {
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin);
    await adminReverify(app(), admin);
    const second = await requestConsent(app(), admin, syntheticMobile()).expect(409);
    expect(second.body).toMatchObject({ code: 'assisted_session_open' });
    await server().post(`${ASSISTED}/sessions/${sessionId}/end`).set(bearer(admin)).expect(204);
    await adminReverify(app(), admin);
    await requestConsent(app(), admin, syntheticMobile()).expect(200);
  });

  it('AD-12 two admins cannot hold one account; the second code is then spent', async () => {
    const [first, second] = [await support(), await support()];
    const { mobile } = await openAssisted(app(), first);
    await adminReverify(app(), second);
    const requested = await requestConsent(app(), second, mobile).expect(200);
    const sessionId = (requested.body as Challenge).sessionId;
    const code = sms(app()).lastCodeFor(mobile);
    const refused = await verifyConsent(app(), second, sessionId, code).expect(409);
    expect(refused.body).toMatchObject({ code: 'assisted_session_open' });
    expect((await sessionRow(sessionId))?.account_id).toBeNull();
    const replay = await verifyConsent(app(), second, sessionId, code).expect(400);
    expect(replay.body).toMatchObject({ code: 'otp_expired' });
  });

  it('AD-12 a new request replaces the admin earlier unanswered one', async () => {
    const admin = await support();
    await adminReverify(app(), admin);
    const mobile = syntheticMobile();
    const first = ((await requestConsent(app(), admin, mobile).expect(200)).body as Challenge)
      .sessionId;
    await requestConsent(app(), admin, mobile).expect(200);
    await verifyConsent(app(), admin, first, sms(app()).lastCodeFor(mobile)).expect(404);
    expect((await sessionRow(first))?.end_reason).toBe('ended');
  });
});

describe('AD-12 numbers that may not be assisted', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { support, sessionRow, audited } = assistedCalls(context);

  async function refusedWith(
    prepare: (accountId: string) => Promise<void>,
    status: number,
    code: string,
  ) {
    const { mobile, login } = await signedUp(app(), { role: 'nurse', languages: ['en'] });
    await prepare(await accountIdOf(app(), login));
    const admin = await support();
    await adminReverify(app(), admin);
    const requested = await requestConsent(app(), admin, mobile).expect(200);
    const sessionId = (requested.body as Challenge).sessionId;
    const refused = await verifyConsent(app(), admin, sessionId, sms(app()).lastCodeFor(mobile));
    expect(refused.status).toBe(status);
    expect(refused.body).toMatchObject({ code });
    expect((await sessionRow(sessionId))?.end_reason).toBe('refused');
    expect(await audited('onboarding.assisted.consent_refused', sessionId)).toHaveLength(1);
    await server().get(`${ASSISTED}/sessions/current`).set(bearer(admin)).expect(404);
  }
  const setStatus = (status: string) => async (id: string) => {
    await db().query(
      "UPDATE app.role_assignment SET application_status = $2 WHERE account_id = $1 AND side = 'provider'",
      [id, status],
    );
  };
  const setRole = (role: string) => async (id: string) => {
    await db().query(
      "UPDATE app.role_assignment SET role = $2 WHERE account_id = $1 AND side = 'provider'",
      [id, role],
    );
  };

  it('AD-12 a suspended account is refused with 403', async () => {
    await refusedWith(
      async (id) => {
        await db().query(
          "UPDATE app.account SET status = 'suspended', suspension_reason = 'other' WHERE id = $1",
          [id],
        );
      },
      403,
      'account_suspended',
    );
  });

  it('AD-12 an application already submitted or approved is not editable', async () => {
    await refusedWith(setStatus('submitted'), 409, 'application_not_editable');
    await refusedWith(setStatus('approved'), 409, 'application_not_editable');
  });

  it('AD-12 a kept deferred grant is unavailable and a sample collector is not assisted', async () => {
    await refusedWith(setRole('doctor'), 409, 'role_unavailable');
    await refusedWith(setRole('sample_collector'), 409, 'role_not_assisted');
  });

  it('AD-12 an account with a pending deletion request is refused', async () => {
    await refusedWith(
      async (id) => {
        await db().query(
          'INSERT INTO app.deletion_request (id, account_id) VALUES (gen_random_uuid(), $1)',
          [id],
        );
      },
      409,
      'deletion_pending',
    );
  });
});
