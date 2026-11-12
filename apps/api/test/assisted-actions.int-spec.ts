import { IDENTITY_CONSENT } from '../src/accounts/consent-versions.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import {
  type AdminLogin,
  adminSignIn,
  otpSignIn,
  signedUp,
  sms,
  useApp,
} from './account-helpers.js';
import {
  ASSISTED,
  assistedDetails,
  assistedUpload,
  adminReverify,
  completeAssisted,
  expireReverification,
  IDENTITY_DOCUMENT,
  openAssisted,
  PHOTO,
  restoreReverification,
  savePayoutAssisted,
} from './assisted-helpers.js';
import { bearer } from './auth-helpers.js';
import { WITH_DEFERRED_ROLES } from './boot-app.js';
import { accountIdOf } from './provider-helpers.js';

const DETAILS = {
  role: 'nurse',
  fullName: 'Synthetic Provider',
  gender: 'female',
  languages: ['en'],
  adultDeclared: true,
};

/** Calls bound to one block's app and database. */
function actionCalls(context: ReturnType<typeof useApp>) {
  const { app, db, server } = context;
  const support = (): Promise<AdminLogin> => adminSignIn(app(), 'support');
  const accountOf = async (sessionId: string) =>
    (
      await db().query<{ account_id: string }>(
        'SELECT account_id FROM app.assisted_session WHERE id = $1',
        [sessionId],
      )
    ).rows[0]?.account_id;
  const grantedBy = async (accountId: string) =>
    (
      await db().query<{ granted_by: string; role: string }>(
        "SELECT role, granted_by FROM app.role_assignment WHERE account_id = $1 AND side = 'provider'",
        [accountId],
      )
    ).rows;
  const sessionUrl = (id: string, path = '') => `${ASSISTED}/sessions/${id}${path}`;
  return { app, db, server, support, accountOf, grantedBy, sessionUrl };
}

describe('AD-12 basic details and provider type', () => {
  const context = useApp(WITH_DEFERRED_ROLES);
  const { app, db, support, accountOf, grantedBy } = actionCalls(context);

  it('AD-12 a new account gets its provider type and finishes setup, without terms or privacy', async () => {
    const admin = await support();
    const session = await openAssisted(app(), admin);
    const missing = await assistedDetails(app(), admin, session.sessionId, {
      ...DETAILS,
      fullName: undefined,
    }).expect(400);
    expect(missing.body).toMatchObject({ code: 'details_missing' });
    const lab = await assistedDetails(app(), admin, session.sessionId, {
      ...DETAILS,
      role: 'lab',
    }).expect(400);
    expect(lab.body).toMatchObject({ code: 'details_missing' });
    const saved = await assistedDetails(app(), admin, session.sessionId, DETAILS).expect(200);
    expect(saved.body).toMatchObject({
      maskedName: 'S•••••••• P•••••••',
      setupComplete: true,
      basicDetailsLocked: true,
      application: { role: 'nurse', status: 'draft', editable: true },
    });
    const accountId = (await accountOf(session.sessionId)) ?? '';
    expect(await grantedBy(accountId)).toEqual([
      { role: 'nurse', granted_by: 'assisted-onboarding' },
    ]);
    const consents = await db().query(
      "SELECT 1 FROM app.consent_record WHERE account_id = $1 AND purpose IN ('terms', 'privacy')",
      [accountId],
    );
    expect(consents.rowCount).toBe(0);
  });

  it('AD-12 deferred and non-assisted provider types are refused at the details step', async () => {
    const admin = await support();
    const session = await openAssisted(app(), admin);
    for (const role of [
      'doctor',
      'dentist',
      'dermatologist',
      'clinic_front_desk',
      'sample_collector',
    ]) {
      await assistedDetails(app(), admin, session.sessionId, { ...DETAILS, role }).expect(400);
    }
    const accountId = (await accountOf(session.sessionId)) ?? '';
    expect(await grantedBy(accountId)).toEqual([]);
  });

  it('AD-12 an existing patient gets a provider side, keeps their name and cannot change it', async () => {
    const { mobile, login } = await signedUp(app());
    const admin = await support();
    const session = await openAssisted(app(), admin, mobile);
    const named = await assistedDetails(app(), admin, session.sessionId, DETAILS).expect(400);
    expect(named.body).toMatchObject({ code: 'details_locked' });
    const provider = { role: DETAILS.role, languages: DETAILS.languages };
    const saved = await assistedDetails(app(), admin, session.sessionId, provider).expect(200);
    expect(saved.body).toMatchObject({
      accountCreated: false,
      maskedName: 'S•••••••• P•••••',
      application: { role: 'nurse', status: 'draft' },
    });
    const accountId = await accountIdOf(app(), login);
    expect(await grantedBy(accountId)).toEqual([
      { role: 'nurse', granted_by: 'assisted-onboarding' },
    ]);
    const name = await db().query<{ full_name: string }>(
      'SELECT full_name FROM app.account_profile WHERE account_id = $1',
      [accountId],
    );
    expect(name.rows[0]?.full_name).toBe('Synthetic Person');
    const other = await assistedDetails(app(), admin, session.sessionId, {
      ...provider,
      role: 'attendant',
    }).expect(409);
    expect(other.body).toMatchObject({ code: 'side_taken' });
    await assistedDetails(app(), admin, session.sessionId, provider).expect(200);
  });
});

/** Admin, session and the payout call for blocks that test the second code. */
function payoutCalls(context: ReturnType<typeof useApp>) {
  const { app, db, server, support, sessionUrl } = actionCalls(context);
  async function readyForPayout() {
    const admin = await support();
    const session = await openAssisted(app(), admin);
    await assistedDetails(app(), admin, session.sessionId, DETAILS).expect(200);
    return { admin, ...session };
  }
  const save = (admin: AdminLogin, sessionId: string, code: string | undefined) =>
    server()
      .put(sessionUrl(sessionId, '/payout'))
      .set(bearer(admin))
      .send({ method: 'upi', holderName: 'Synthetic Provider', upiId: 'synthetic@okbank', code });
  const payoutRow = async (sessionId: string) =>
    (
      await db().query<{ saved: boolean; held: boolean; stored: string }>(
        `SELECT s.payout_saved_at IS NOT NULL AS saved, s.payout_challenge_id IS NOT NULL AS held,
                (SELECT count(*) FROM app.payout_account p WHERE p.account_id = s.account_id) AS stored
           FROM app.assisted_session s WHERE s.id = $1`,
        [sessionId],
      )
    ).rows[0];
  return { readyForPayout, save, payoutRow };
}

describe('AD-12 the payout code', () => {
  const context = useApp();
  const { app, server, sessionUrl } = actionCalls(context);
  const { readyForPayout, save, payoutRow } = payoutCalls(context);

  it('AD-12 a payout cannot be saved without a code, with a wrong code, or with a stale TOTP', async () => {
    const { admin, sessionId, mobile } = await readyForPayout();
    await adminReverify(app(), admin);
    expect((await save(admin, sessionId, '123456').expect(409)).body).toMatchObject({
      code: 'payout_code_required',
    });
    await server()
      .post(sessionUrl(sessionId, '/payout/code/resend'))
      .set(bearer(admin))
      .expect(409);
    const sent = await server()
      .post(sessionUrl(sessionId, '/payout/code'))
      .set(bearer(admin))
      .expect(200);
    expect(sent.body).toMatchObject({ mobile: `••••••${mobile.slice(-4)}` });
    expect(Object.keys(sent.body as object).sort((a, b) => a.localeCompare(b))).toEqual([
      'expiresInSeconds',
      'mobile',
      'resendInSeconds',
    ]);
    expect(sms(app()).sent.findLast((m) => m.to === mobile)).toMatchObject({
      templateId: 'otp_assisted_payout',
    });
    const code = sms(app()).lastCodeFor(mobile);
    const wrong = code === '000000' ? '111111' : '000000';
    expect((await save(admin, sessionId, wrong).expect(400)).body).toMatchObject({
      code: 'otp_incorrect',
    });
    await expireReverification(app(), admin);
    expect((await save(admin, sessionId, code).expect(403)).body).toMatchObject({
      code: 'reverification_required',
    });
    expect(await payoutRow(sessionId)).toEqual({ saved: false, held: true, stored: '0' });
    await restoreReverification(app(), admin);
    await save(admin, sessionId, code).expect(200);
  });
});

describe('AD-12 one payout code, one save', () => {
  const context = useApp();
  const { app, db, server, sessionUrl } = actionCalls(context);
  const { readyForPayout, save, payoutRow } = payoutCalls(context);

  it('AD-12 one code saves once; the provider own re-verification code does not work', async () => {
    const { admin, sessionId, mobile } = await readyForPayout();
    await adminReverify(app(), admin);
    await server().post(sessionUrl(sessionId, '/payout/code')).set(bearer(admin)).expect(200);
    const code = sms(app()).lastCodeFor(mobile);
    const provider = (await otpSignIn(app(), mobile)).login;
    await server().post('/v1/auth/reverify').set(bearer(provider)).expect(200);
    await save(admin, sessionId, sms(app()).lastCodeFor(mobile)).expect(400);
    const saved = await save(admin, sessionId, code).expect(200);
    expect(saved.body).toMatchObject({
      payoutCodeSent: false,
      application: { payoutOnFile: true },
    });
    expect(await payoutRow(sessionId)).toEqual({ saved: true, held: false, stored: '1' });
    expect((await save(admin, sessionId, code).expect(409)).body).toMatchObject({
      code: 'payout_code_required',
    });
  });

  it('AD-12 a new payout code goes out through the session after the cooldown and replaces the old', async () => {
    const { admin, sessionId, mobile } = await readyForPayout();
    await adminReverify(app(), admin);
    await server().post(sessionUrl(sessionId, '/payout/code')).set(bearer(admin)).expect(200);
    const resend = () =>
      server().post(sessionUrl(sessionId, '/payout/code/resend')).set(bearer(admin));
    await resend().expect(429);
    await db().query(
      "UPDATE app.otp_challenge SET resend_at = now() - interval '1 second' WHERE id = (SELECT payout_challenge_id FROM app.assisted_session WHERE id = $1)",
      [sessionId],
    );
    const again = await resend().expect(200);
    expect(again.body).toMatchObject({ mobile: `••••••${mobile.slice(-4)}` });
    await save(admin, sessionId, sms(app()).lastCodeFor(mobile)).expect(200);
  });

  it('AD-12 a payout code is bound to its session and cannot be used from another', async () => {
    const first = await readyForPayout();
    const second = await readyForPayout();
    await adminReverify(app(), first.admin);
    await adminReverify(app(), second.admin);
    await server()
      .post(sessionUrl(first.sessionId, '/payout/code'))
      .set(bearer(first.admin))
      .expect(200);
    const code = sms(app()).lastCodeFor(first.mobile);
    await save(second.admin, first.sessionId, code).expect(404);
    await save(second.admin, second.sessionId, code).expect(409);
  });
});

describe('AD-12 a full assisted application', () => {
  const context = useApp();
  const { app, db, server, support, sessionUrl } = actionCalls(context);

  it.each(['nurse', 'attendant'] as const)(
    'AD-12 a %s is set up, submitted and the session ends; the provider accepts terms at their own sign-in',
    async (role) => {
      const admin = await support();
      const done = await completeAssisted(app(), admin, role);
      expect(done.submitted).toMatchObject({
        ended: true,
        payoutCodeSent: false,
        application: {
          status: 'submitted',
          missing: [],
          payoutOnFile: true,
          identity: 'in_review',
        },
      });
      await server().get(sessionUrl(done.sessionId)).set(bearer(admin)).expect(409);
      const row = await db().query<{ end_reason: string }>(
        'SELECT end_reason FROM app.assisted_session WHERE id = $1',
        [done.sessionId],
      );
      expect(row.rows[0]?.end_reason).toBe('submitted');
      const events = await db().query(
        "SELECT actor_id, actor_role FROM app.application_event WHERE account_id = $1 AND to_status = 'submitted'",
        [done.accountId],
      );
      expect(events.rows).toEqual([{ actor_id: admin.id, actor_role: 'support' }]);
      const consent = await db().query(
        'SELECT assisted_session_id FROM app.consent_record WHERE account_id = $1 AND purpose = $2',
        [done.accountId, IDENTITY_CONSENT.purpose],
      );
      expect(consent.rows).toEqual([{ assisted_session_id: done.sessionId }]);
      expect(sms(app()).sent.findLast((m) => m.to === done.mobile)).toMatchObject({
        templateId: 'application_assisted_submitted',
      });
      const login = (await otpSignIn(app(), done.mobile)).login;
      const me = await server().get('/v1/me').set(bearer(login)).expect(200);
      expect(
        (me.body as { consentsDue: { purpose: string }[] }).consentsDue
          .map((c) => c.purpose)
          .sort((a, b) => a.localeCompare(b)),
      ).toEqual(['privacy', 'terms']);
    },
  );
});

describe('AD-12 every action route checks the session first', () => {
  const context = useApp();
  const { app, server, support, sessionUrl } = actionCalls(context);
  const calls = (admin: AdminLogin, id: string) => {
    const put = (path: string, body: object, upload = false) => {
      const call = server().put(sessionUrl(id, path)).set(bearer(admin));
      return upload
        ? call.set('Content-Type', UPLOAD_CONTENT_TYPE).send(JSON.stringify(body))
        : call.send(body);
    };
    const post = (path: string) => server().post(sessionUrl(id, path)).set(bearer(admin));
    const file = { contentType: 'application/pdf', contentBase64: 'JVBERg==' };
    return [
      () => put('/details', DETAILS),
      () => put('/documents/address_proof', file, true),
      () => put('/identity-document', { ...file, ...IDENTITY_DOCUMENT }, true),
      () => put('/profile', { qualifications: 'x' }),
      () => put('/photo', PHOTO, true),
      () => post('/payout/code'),
      () => post('/payout/code/resend'),
      () =>
        put('/payout', {
          method: 'upi',
          holderName: 'Synthetic',
          upiId: 'synthetic@okbank',
          code: '123456',
        }),
      () => post('/submit'),
    ];
  };

  it('AD-12 another admin gets 404, and an ended session 409, on routes 7 to 15', async () => {
    const owner = await support();
    const intruder = await support();
    const { sessionId } = await openAssisted(app(), owner);
    await adminReverify(app(), intruder);
    for (const call of calls(intruder, sessionId)) expect((await call()).status).toBe(404);
    await server().post(sessionUrl(sessionId, '/end')).set(bearer(owner)).expect(204);
    await adminReverify(app(), owner);
    for (const call of calls(owner, sessionId)) {
      const response = await call();
      expect([response.status, (response.body as { code?: string }).code]).toEqual([
        409,
        'assisted_session_ended',
      ]);
    }
  });

  it('AD-12 an upload route needs consentReadAloud true for the identity document', async () => {
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin);
    await assistedDetails(app(), admin, sessionId, DETAILS).expect(200);
    await assistedUpload(app(), admin, sessionId, 'identity-document', {
      ...IDENTITY_DOCUMENT,
      consentReadAloud: false,
    }).expect(400);
    await assistedUpload(app(), admin, sessionId, 'identity-document', {
      ...IDENTITY_DOCUMENT,
      consentVersion: 'old.1',
    }).expect(409);
    await assistedUpload(app(), admin, sessionId, 'documents/unknown_item').expect(404);
  });
});

describe('AD-12 nothing Restricted comes back', () => {
  const context = useApp();
  const { app, server, support, sessionUrl, db } = actionCalls(context);
  const BANK = {
    method: 'bank',
    holderName: 'Leakcheck Holder',
    accountNumber: '123456789012',
    ifsc: 'SYNT0123456',
  };

  it('AD-12 no answer carries a full number, document reference or expiry, payout value or name', async () => {
    const admin = await support();
    const session = await openAssisted(app(), admin);
    const texts: string[] = [];
    const body = { ...DETAILS, fullName: 'Leakcheck Person' };
    texts.push((await assistedDetails(app(), admin, session.sessionId, body).expect(200)).text);
    const upload = await assistedUpload(
      app(),
      admin,
      session.sessionId,
      'documents/nursing_registration',
      {
        reference: 'LEAK-98765',
        expiresOn: '2031-02-03',
      },
    ).expect(200);
    texts.push(upload.text);
    texts.push(
      (
        await assistedUpload(
          app(),
          admin,
          session.sessionId,
          'identity-document',
          IDENTITY_DOCUMENT,
        ).expect(200)
      ).text,
    );
    texts.push(
      (await assistedUpload(app(), admin, session.sessionId, 'photo', PHOTO).expect(200)).text,
    );
    texts.push(await savePayoutAssisted(app(), admin, session, BANK));
    texts.push(
      (await server().get(sessionUrl(session.sessionId)).set(bearer(admin)).expect(200)).text,
    );
    const secrets = [
      session.mobile.slice(-10),
      'LEAK-98765',
      '2031-02-03',
      '123456789012',
      'SYNT0123456',
      'Leakcheck',
      '9012',
    ];
    for (const secret of secrets) for (const text of texts) expect(text).not.toContain(secret);
    const audit = await db().query('SELECT 1 FROM audit.entry e WHERE row_to_json(e)::text ~ $1', [
      secrets.slice(0, 5).join('|'),
    ]);
    expect(audit.rows).toEqual([]);
  });

  it('AD-12 there is no route that reads a document, photo, identity document or payout back', async () => {
    const admin = await support();
    const { sessionId } = await openAssisted(app(), admin);
    for (const path of [
      '/documents/address_proof',
      '/identity-document',
      '/photo',
      '/payout',
      '/profile',
      '/details',
      '/identity',
    ]) {
      await server().get(sessionUrl(sessionId, path)).set(bearer(admin)).expect(404);
    }
  });
});

describe('AD-12 audit of assisted actions', () => {
  const context = useApp();
  const { app, db, support } = actionCalls(context);
  const PAIRS: [string, string][] = [
    ['details_saved', 'account.setup.completed'],
    ['document_uploaded', 'provider_document.uploaded'],
    ['identity_document_uploaded', 'provider_application.identity.document_uploaded'],
    ['profile_saved', 'provider_profile.saved'],
    ['photo_uploaded', 'provider_profile.photo.uploaded'],
    ['payout_code_requested', 'provider_application.payout_details.saved'],
    ['payout_saved', 'provider_application.payout_details.saved'],
    ['submitted', 'provider_application.submitted'],
  ];

  it('AD-12 each action is audited against the session with the admin as actor and the inner entry', async () => {
    const admin = await support();
    const done = await completeAssisted(app(), admin, 'nurse');
    for (const [op, inner] of PAIRS.filter(([op]) => op !== 'payout_code_requested')) {
      const marker = await db().query<{ actor_id: string; actor_role: string; entity: string }>(
        `SELECT m.actor_id, m.actor_role, m.entity FROM audit.entry m JOIN audit.entry i
           ON i.correlation_id = m.correlation_id AND i.actor_id = m.actor_id AND i.action = $3
          WHERE m.action = $1 AND m.entity_id = $2`,
        [`onboarding.assisted.${op}`, done.sessionId, inner],
      );
      expect(marker.rows[0]).toEqual({
        actor_id: admin.id,
        actor_role: 'support',
        entity: 'assisted_session',
      });
    }
    const requested = await db().query(
      "SELECT 1 FROM audit.entry WHERE action = 'onboarding.assisted.payout_code_requested' AND entity_id = $1 AND actor_id = $2",
      [done.sessionId, admin.id],
    );
    expect(requested.rowCount).toBe(1);
    const leaked = await db().query('SELECT 1 FROM audit.entry e WHERE row_to_json(e)::text ~ $1', [
      `synthetic@okbank|${done.mobile.slice(-10)}`,
    ]);
    expect(leaked.rows).toEqual([]);
  });
});
