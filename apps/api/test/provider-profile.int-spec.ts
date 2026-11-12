import type { FakeIdentityVerifier } from '../src/adapters/fakes.js';
import { IDENTITY_VERIFIER } from '../src/adapters/identity.port.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import { adminSignIn, nextTotp, signedUp, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import {
  accountIdOf,
  listedProvider,
  submittedProvider,
  SYNTHETIC_PDF,
  verifyIdentity,
} from './provider-helpers.js';

// A synthetic one-pixel PNG header; never a real photo.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]).toString(
  'base64',
);
const photo = { contentType: 'image/png', contentBase64: PNG };

describe('Provider public profile: details and photo (PO-05, KY-03)', () => {
  const { app, server } = useApp();
  const uploadPhoto = (login: Login, body: object = photo) =>
    server()
      .put('/v1/provider/profile/photo')
      .set(bearer(login))
      .set('Content-Type', UPLOAD_CONTENT_TYPE)
      .send(JSON.stringify(body));
  const save = (login: Login, body: object) =>
    server().put('/v1/provider/profile').set(bearer(login)).send(body);

  it('PO-05 a provider saves qualifications, experience and a photo while the application is editable', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await save(login, { qualifications: 'x'.repeat(301) }).expect(400);
    await save(login, { experienceYears: 61 }).expect(400);
    const saved = await save(login, { qualifications: ' GNM, synthetic ', experienceYears: 7 });
    expect(saved.body).toEqual({
      qualifications: 'GNM, synthetic',
      experienceYears: 7,
      hasPhoto: false,
      photoVerified: false,
    });
    await uploadPhoto(login, {
      contentType: 'application/pdf',
      contentBase64: SYNTHETIC_PDF,
    }).expect(422);
    expect((await uploadPhoto(login).expect(200)).body).toMatchObject({ hasPhoto: true });
    const own = await server().get('/v1/provider/profile/photo').set(bearer(login)).expect(200);
    expect(own.body).toEqual(photo);
    const application = await server().get('/v1/provider/application').set(bearer(login));
    expect(application.body).toMatchObject({ profile: { experienceYears: 7, hasPhoto: true } });
    const patient = await signedUp(app());
    await server().get('/v1/provider/profile').set(bearer(patient.login)).expect(403);
  });

  it('PO-05 the profile is locked once submitted; the verifier sees it and opens the photo', async () => {
    const provider = await submittedProvider(app(), 'nurse');
    await save(provider.login, { experienceYears: 3 }).expect(409);
    await uploadPhoto(provider.login).expect(409);
    const verifier = await adminSignIn(app(), 'verifier');
    const path = `/admin/v1/applications/${provider.accountId}`;
    const review = await server().get(path).set(bearer(verifier)).expect(200);
    expect(review.body).toMatchObject({ profile: { hasPhoto: false } });
    await server().get(`${path}/photo`).set(bearer(verifier)).expect(404);
  });

  it('PO-05 the public profile shows qualifications, experience and the photo once listed', async () => {
    const draft = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await save(draft.login, { qualifications: 'GNM', experienceYears: 2 }).expect(200);
    await uploadPhoto(draft.login).expect(200);
    const draftId = await accountIdOf(app(), draft.login);
    // Not published: neither the profile nor the photo is public.
    await server().get(`/v1/providers/${draftId}/photo`).expect(404);

    const listed = await listedProvider(app(), 'nurse', 'nursing_wound_dressing');
    const profile = await server().get(`/v1/providers/${listed.accountId}`).expect(200);
    expect(profile.body).toMatchObject({
      qualifications: null,
      experienceYears: null,
      hasPhoto: false,
    });
    await server().get(`/v1/providers/${listed.accountId}/photo`).expect(404);
  });

  it('KY-03 a photo from the identity check is published and cannot be replaced', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    const partner = app().get<FakeIdentityVerifier>(IDENTITY_VERIFIER);
    partner.attributes = {
      fullName: 'Synthetic Verified',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      address: '1 Synthetic Lane',
      photo,
    };
    try {
      await verifyIdentity(app(), login);
    } finally {
      partner.attributes = undefined;
    }
    const own = await server().get('/v1/provider/profile').set(bearer(login)).expect(200);
    expect(own.body).toMatchObject({ hasPhoto: true, photoVerified: true });
    expect((await uploadPhoto(login).expect(409)).body).toMatchObject({ code: 'identity_locked' });
    // A new identity check unlocks it.
    await verifyIdentity(app(), login);
    expect((await uploadPhoto(login).expect(200)).body).toMatchObject({ photoVerified: false });
  });
});

describe('Suspended application status (PO-04)', () => {
  const { app, db, server } = useApp();

  it('PO-04 suspending an approved provider suspends the application; reinstating restores it', async () => {
    const provider = await listedProvider(app(), 'nurse', 'nursing_wound_dressing');
    const support = await adminSignIn(app(), 'support');
    // One fresh TOTP code covers both changes (decision L-11).
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(support))
      .send({ code: nextTotp(support.secret) })
      .expect(204);
    const act = (action: 'suspend' | 'reinstate') =>
      server()
        .post(`/admin/v1/users/${provider.accountId}/${action}`)
        .set(bearer(support))
        .send(action === 'suspend' ? { reason: 'safety_concern' } : {})
        .expect(204);
    const status = async () =>
      (
        await db().query<{ status: string }>(
          `SELECT application_status AS status FROM app.role_assignment
            WHERE account_id = $1 AND side = 'provider'`,
          [provider.accountId],
        )
      ).rows[0]?.status;
    await act('suspend');
    expect(await status()).toBe('suspended');
    await server().get(`/v1/providers/${provider.accountId}`).expect(404);
    await act('reinstate');
    expect(await status()).toBe('approved');
    const events = await db().query<{ to_status: string; actor_role: string }>(
      `SELECT to_status, actor_role FROM app.application_event
        WHERE account_id = $1 ORDER BY created_at DESC LIMIT 2`,
      [provider.accountId],
    );
    expect(events.rows).toEqual([
      { to_status: 'approved', actor_role: 'support' },
      { to_status: 'suspended', actor_role: 'support' },
    ]);
  });
});
