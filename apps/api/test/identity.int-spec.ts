import { IDENTITY_CONSENT } from '../src/accounts/consent-versions.js';
import { EICAR_MARKER, type FakeIdentityVerifier } from '../src/adapters/fakes.js';
import { IDENTITY_VERIFIER } from '../src/adapters/identity.port.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  accountIdOf,
  submittedProvider,
  uploadIdentityDocument,
  verifyIdentity,
} from './provider-helpers.js';

interface Application {
  status: string;
  identityNameMatch: string | null;
  identityDetailsVerified: boolean;
  identity: string;
  identityConsentVersion: string;
  missing: string[];
  editable: boolean;
}

describe('Identity check: consent, partner detail and outage (KY-01, KY-05, KY-08)', () => {
  const { app, db, server } = useApp();
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;

  it('KY-05 the last four digits and the partner reference are kept encrypted only', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['en'] });
    await verifyIdentity(app(), login);
    expect(await application(login)).toMatchObject({ identityMethod: 'digilocker' });
    const stored = await db().query<{ detail: string }>(
      'SELECT detail::text FROM app.identity_check WHERE account_id = $1',
      [await accountIdOf(app(), login)],
    );
    expect(stored.rows[0]?.detail).toBeTruthy();
    expect(stored.rows[0]?.detail).not.toMatch(/0000|fake-|lastFour|transactionId/);
  });

  it('KY-01 the check starts only with consent to the text in force, which is recorded', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    const start = (body: object) =>
      server().post('/v1/provider/application/identity/start').set(bearer(login)).send(body);
    await start({ locale: 'or' }).expect(400);
    expect(
      (await start({ locale: 'or', consentVersion: '2020-01-old.1' }).expect(409)).body,
    ).toMatchObject({ code: 'consent_outdated' });
    const { identityConsentVersion } = await application(login);
    await start({ locale: 'or', consentVersion: identityConsentVersion }).expect(200);
    await start({ locale: 'or', consentVersion: identityConsentVersion }).expect(200);
    const consents = await db().query<{ version: string; locale: string }>(
      `SELECT version, locale FROM app.consent_record
        WHERE account_id = $1 AND purpose = 'identity_verification'`,
      [await accountIdOf(app(), login)],
    );
    expect(consents.rows).toEqual([{ version: identityConsentVersion, locale: 'or' }]);
  });

  it('KY-08 an unreachable partner is one stable error; the provider can retry', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['en'] });
    const partner = app().get<FakeIdentityVerifier>(IDENTITY_VERIFIER);
    const body = { locale: 'en', consentVersion: IDENTITY_CONSENT.version };
    partner.failing = true;
    try {
      const refused = await server()
        .post('/v1/provider/application/identity/start')
        .set(bearer(login))
        .send(body)
        .expect(503);
      expect(refused.body).toMatchObject({ code: 'identity_unavailable' });
      await server()
        .post('/v1/provider/application/identity/complete')
        .set(bearer(login))
        .send({ code: 'approved', reference: 'any-reference' })
        .expect(503);
    } finally {
      partner.failing = false;
    }
    await verifyIdentity(app(), login);
    expect((await application(login)).identity).toBe('verified');
  });
});

describe('Identity fallback document and its review (KY-07)', () => {
  const { app, server } = useApp();
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;

  it('KY-07 a fallback document puts identity in review; an Aadhaar card is not a kind', async () => {
    const { login } = await signedUp(app(), { role: 'attendant', languages: ['or'] });
    await uploadIdentityDocument(app(), login, { kind: 'aadhaar' }).expect(400);
    await uploadIdentityDocument(app(), login, { consentVersion: '2020-01-old.1' }).expect(409);
    const infected = Buffer.from(`%PDF-1.7 ${EICAR_MARKER}`).toString('base64');
    await uploadIdentityDocument(app(), login, { contentBase64: infected }).expect(400);
    expect((await application(login)).identity).toBe('not_started');
    const saved = await uploadIdentityDocument(app(), login, { kind: 'passport' }).expect(200);
    expect(saved.body).toMatchObject({
      identity: 'in_review',
      identityMethod: 'manual',
      identityDocumentKind: 'passport',
    });
    expect((saved.body as Application).missing).not.toContain('identity');
    // A partner code cannot settle a check that waits for a verifier.
    await server()
      .post('/v1/provider/application/identity/complete')
      .set(bearer(login))
      .send({ code: 'approved', reference: 'not-the-pending-one' })
      .expect(409);
    // Choosing the partner afterwards drops the document.
    await verifyIdentity(app(), login);
    expect(await application(login)).toMatchObject({
      identity: 'verified',
      identityDocumentKind: null,
    });
  });

  it('KY-07 a verifier opens the fallback document and accepts it before approving', async () => {
    const provider = await submittedProvider(app(), 'attendant', 'document');
    const verifier = await adminSignIn(app(), 'verifier');
    const path = `/admin/v1/applications/${provider.accountId}`;
    const decide = (body: object) =>
      server().post(`${path}/decision`).set(bearer(verifier)).send(body);
    await server()
      .post(`${path}/identity`)
      .set(bearer(verifier))
      .send({ status: 'accepted' })
      .expect(409);
    const review = await server().get(path).set(bearer(verifier)).expect(200);
    expect(review.body).toMatchObject({ identity: 'in_review', identityMethod: 'manual' });
    expect((await decide({ decision: 'approve' }).expect(409)).body).toMatchObject({
      code: 'identity_not_verified',
    });
    const file = await server().get(`${path}/identity-document`).set(bearer(verifier)).expect(200);
    expect(file.body).toMatchObject({ contentType: 'application/pdf' });
    await server()
      .post(`${path}/identity`)
      .set(bearer(verifier))
      .send({ status: 'accepted' })
      .expect(204);
    const again = await server()
      .post(`${path}/identity`)
      .set(bearer(verifier))
      .send({ status: 'rejected' })
      .expect(409);
    expect(again.body).toMatchObject({ code: 'identity_not_in_review' });
    await decide({ decision: 'approve' }).expect(204);
    expect(await application(provider.login)).toMatchObject({
      status: 'approved',
      identity: 'verified',
      identityMethod: 'manual',
    });
  });

  it('KY-07 a rejected fallback document sends the provider back to the identity step', async () => {
    const provider = await submittedProvider(app(), 'attendant', 'document');
    const verifier = await adminSignIn(app(), 'verifier');
    const path = `/admin/v1/applications/${provider.accountId}`;
    await server().get(path).set(bearer(verifier)).expect(200);
    await server()
      .post(`${path}/identity`)
      .set(bearer(verifier))
      .send({ status: 'rejected' })
      .expect(204);
    await server()
      .post(`${path}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'request_changes', reason: 'identity_mismatch' })
      .expect(204);
    const back = await application(provider.login);
    expect(back).toMatchObject({ identity: 'failed', editable: true });
    expect(back.missing).toEqual(['identity']);
    await uploadIdentityDocument(app(), provider.login).expect(200);
    expect((await application(provider.login)).identity).toBe('in_review');
    const support = await adminSignIn(app(), 'support');
    await server().get(`${path}/identity-document`).set(bearer(support)).expect(403);
  });
});

describe('Verified details pre-fill the profile and the name is matched (KY-03, KY-04)', () => {
  const { app, db, server } = useApp();
  const partner = () => app().get<FakeIdentityVerifier>(IDENTITY_VERIFIER);
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;
  const draft = async (login: Parameters<typeof bearer>[0]) =>
    (
      (await server().get('/v1/me').set(bearer(login)).expect(200)).body as {
        setup: { draft: { fullName: string; gender: string } };
      }
    ).setup.draft;
  const verifiedAs = async (login: Parameters<typeof bearer>[0], fullName: string) => {
    partner().attributes = {
      fullName,
      gender: 'female',
      dateOfBirth: '1990-01-01',
      address: '1 Synthetic Lane, Bhubaneswar 751001',
    };
    try {
      await verifyIdentity(app(), login);
    } finally {
      partner().attributes = undefined;
    }
  };
  const details = (login: Parameters<typeof bearer>[0]) =>
    server().get('/v1/provider/application/identity/details').set(bearer(login));

  it('KY-03 the verified name and gender replace the typed ones and cannot be edited', async () => {
    const setup = { role: 'nurse', languages: ['or'], fullName: 'Synthetic Typed', gender: 'male' };
    const { login } = await signedUp(app(), setup);
    await details(login).expect(404);
    await verifiedAs(login, 'Synthetic Verified');
    expect(await draft(login)).toMatchObject({ fullName: 'Synthetic Verified', gender: 'female' });
    expect(await application(login)).toMatchObject({ identityDetailsVerified: true });
    const correct = (body: object) => server().put('/v1/me/profile').set(bearer(login)).send(body);
    expect((await correct({ fullName: 'Synthetic Other' }).expect(409)).body).toMatchObject({
      code: 'identity_locked',
    });
    await correct({ gender: 'male' }).expect(409);
    // Unchanged values and fields the check did not verify still save.
    await correct({ fullName: 'Synthetic Verified', languages: ['or', 'en'] }).expect(204);
  });

  it('KY-03 date of birth and address are kept encrypted and shown to the provider only', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await verifiedAs(login, 'Synthetic Verified');
    expect((await details(login).expect(200)).body).toEqual({
      dateOfBirth: '1990-01-01',
      address: '1 Synthetic Lane, Bhubaneswar 751001',
    });
    const accountId = await accountIdOf(app(), login);
    const stored = await db().query<{ details: string }>(
      'SELECT verified_details::text AS details FROM app.identity_check WHERE account_id = $1',
      [accountId],
    );
    expect(stored.rows[0]?.details).not.toMatch(/1990|Synthetic Lane/);
    const verifier = await adminSignIn(app(), 'verifier');
    const review = await server()
      .get(`/admin/v1/applications/${accountId}`)
      .set(bearer(verifier))
      .expect(200);
    expect(JSON.stringify(review.body)).not.toMatch(/1990|Synthetic Lane/);
    const other = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await details(other.login).expect(404);
  });

  it('KY-03 a new check unlocks the profile and drops the earlier details', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await verifiedAs(login, 'Synthetic Verified');
    await uploadIdentityDocument(app(), login).expect(200);
    await details(login).expect(404);
    expect(await application(login)).toMatchObject({
      identityDetailsVerified: false,
      identityNameMatch: null,
    });
    await server()
      .put('/v1/me/profile')
      .set(bearer(login))
      .send({ fullName: 'Synthetic Other' })
      .expect(204);
  });

  it('KY-04 a name that differs from the one typed at sign-up is flagged for the verifier', async () => {
    const typed = { role: 'nurse', languages: ['or'], fullName: 'Synthetic Person' };
    const same = await signedUp(app(), typed);
    await verifiedAs(same.login, 'PERSON Synthetic K');
    expect((await application(same.login)).identityNameMatch).toBe('match');
    const differs = await signedUp(app(), typed);
    await verifiedAs(differs.login, 'Another Human');
    expect((await application(differs.login)).identityNameMatch).toBe('mismatch');
    // A partner that shares no details leaves nothing to match or lock.
    const bare = await signedUp(app(), typed);
    await verifyIdentity(app(), bare.login);
    expect(await application(bare.login)).toMatchObject({
      identityNameMatch: null,
      identityDetailsVerified: false,
    });
  });
});
