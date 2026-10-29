import {
  adminSignIn,
  otpSignIn,
  requestCode,
  reverify,
  signedUp,
  sms,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';

describe('Account data rights: correct, export, request deletion (AC-06, PR-04)', () => {
  const { app, server } = useApp();
  const me = async (login: Login) =>
    (await server().get('/v1/me').set(bearer(login)).expect(200)).body as Record<string, unknown>;
  const correct = (login: Login, body: object) =>
    server().put('/v1/me/profile').set(bearer(login)).send(body);

  it('AC-06 a user corrects their name and gender; the change is visible at once', async () => {
    const { login } = await signedUp(app());
    await correct(login, { fullName: 'ସୀତା ମହାନ୍ତି', gender: 'undisclosed' }).expect(204);
    expect(await me(login)).toMatchObject({
      setup: { draft: { fullName: 'ସୀତା ମହାନ୍ତି', gender: 'undisclosed' } },
    });
  });

  it('AC-06 only fields the account’s roles use can change; languages never empty', async () => {
    const patient = await signedUp(app());
    await correct(patient.login, { languages: ['en'] }).expect(400);
    await correct(patient.login, { organisationName: 'Not a lab' }).expect(400);
    const nurse = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await correct(nurse.login, { languages: [] }).expect(400);
    await correct(nurse.login, { languages: ['or', 'en'] }).expect(204);
    await correct(nurse.login, { role: 'doctor' }).expect(400);
  });

  it('AC-06 a lab renames itself; its organisation follows', async () => {
    const lab = await signedUp(app(), {
      role: 'lab',
      languages: ['or'],
      organisationName: 'Old Synthetic Lab',
    });
    await server().get('/v1/organisation').set(bearer(lab.login)).expect(200);
    await correct(lab.login, { organisationName: 'New Synthetic Lab' }).expect(204);
    const organisation = await server().get('/v1/organisation').set(bearer(lab.login)).expect(200);
    expect(organisation.body).toMatchObject({ name: 'New Synthetic Lab' });
  });

  it('PR-04 export needs a fresh OTP and holds the full record of the account', async () => {
    const { mobile, login } = await signedUp(app(), { role: 'representative' });
    await server()
      .post('/v1/me/linked-patients')
      .set(bearer(login))
      .send({
        fullName: 'Synthetic Elder',
        birthYear: 1950,
        gender: 'female',
        relationship: 'parent',
      })
      .expect(201);
    await server().get('/v1/me/export').set(bearer(login)).expect(403);
    await reverify(app(), mobile, login);
    const exported = await server().get('/v1/me/export').set(bearer(login)).expect(200);
    expect(exported.headers['cache-control']).toBe('no-store');
    expect(exported.body).toMatchObject({
      mobile,
      roles: [{ role: 'representative' }],
      linkedPatients: [{ fullName: 'Synthetic Elder', relationship: 'parent' }],
      deletionRequestedAt: null,
    });
    expect((exported.body as { consents: unknown[] }).consents).toHaveLength(2);
  });

  it('D-3 a deletion request needs a fresh OTP, is idempotent, visible to support and cancellable', async () => {
    const { mobile, login } = await signedUp(app());
    await server().post('/v1/me/deletion-request').set(bearer(login)).expect(403);
    await reverify(app(), mobile, login);
    await server().post('/v1/me/deletion-request').set(bearer(login)).expect(204);
    await server().post('/v1/me/deletion-request').set(bearer(login)).expect(204);
    const requestedAt = (await me(login)).deletionRequestedAt;
    expect(typeof requestedAt).toBe('string');

    const support = await adminSignIn(app(), 'support');
    const accountId = (
      (await server().get('/admin/v1/users').query({ q: mobile }).set(bearer(support)).expect(200))
        .body as { items: { id: string }[] }
    ).items[0]?.id;
    const detail = await server()
      .get(`/admin/v1/users/${accountId ?? ''}`)
      .set(bearer(support))
      .expect(200);
    expect(detail.body).toMatchObject({ deletionRequestedAt: requestedAt });

    await server().delete('/v1/me/deletion-request').set(bearer(login)).expect(204);
    await server().delete('/v1/me/deletion-request').set(bearer(login)).expect(409);
    expect(await me(login)).toMatchObject({ deletionRequestedAt: null });
  });
});

describe('Phone-number change (owner decision O-3)', () => {
  const { app, server } = useApp();

  function startChange(login: Login, mobile: string) {
    return server().post('/v1/me/mobile').set(bearer(login)).send({ mobile });
  }
  function finishChange(login: Login, challengeId: string, newMobile: string) {
    return server()
      .post('/v1/me/mobile/verify')
      .set(bearer(login))
      .send({ challengeId, code: sms(app()).lastCodeFor(newMobile) });
  }

  it('O-3 needs a fresh OTP on the current number, then a code on the new one', async () => {
    const { mobile, login } = await signedUp(app());
    const newMobile = syntheticMobile();
    expect((await startChange(login, newMobile)).status).toBe(403);
    await reverify(app(), mobile, login);
    const started = await startChange(login, newMobile);
    expect(started.status).toBe(200);
    const challengeId = (started.body as { challengeId: string }).challengeId;
    expect((await finishChange(login, challengeId, newMobile)).status).toBe(204);
    const view = await server().get('/v1/me').set(bearer(login)).expect(200);
    expect((view.body as { mobile: string }).mobile).toContain(newMobile.slice(-4));
  });

  it('O-3 after the change the new number signs in to the same account; the old one does not', async () => {
    const { mobile, login } = await signedUp(app());
    const otherDevice = await otpSignIn(app(), mobile);
    const newMobile = syntheticMobile();
    await reverify(app(), mobile, login);
    const started = await startChange(login, newMobile);
    await finishChange(login, (started.body as { challengeId: string }).challengeId, newMobile);

    await server().get('/v1/me').set(bearer(otherDevice.login)).expect(401);
    await server().post('/v1/auth/refresh').set('Cookie', otherDevice.login.cookie).expect(401);
    await server().get('/v1/me').set(bearer(login)).expect(200);

    const viaNew = await otpSignIn(app(), newMobile);
    expect((await server().get('/v1/me').set(bearer(viaNew.login))).body).toMatchObject({
      setup: { complete: true },
      roles: [{ role: 'patient' }],
    });
    const viaOld = await otpSignIn(app(), mobile);
    expect((await server().get('/v1/me').set(bearer(viaOld.login))).body).toMatchObject({
      setup: { complete: false },
      roles: [],
    });
  });

  it('O-3 a number that belongs to another account is refused after it is proven', async () => {
    const taken = await signedUp(app());
    const { mobile, login } = await signedUp(app());
    await reverify(app(), mobile, login);
    const started = await startChange(login, taken.mobile);
    expect(started.status).toBe(200);
    const done = await finishChange(
      login,
      (started.body as { challengeId: string }).challengeId,
      taken.mobile,
    );
    expect(done.status).toBe(409);
    expect(done.body).toMatchObject({ code: 'mobile_in_use' });
  });

  it('O-3 the same number, an invalid number, and a change code used to sign in are refused', async () => {
    const { mobile, login } = await signedUp(app());
    await reverify(app(), mobile, login);
    expect((await startChange(login, mobile)).body).toMatchObject({ code: 'mobile_unchanged' });
    expect((await startChange(login, '12345')).status).toBe(400);
    const newMobile = syntheticMobile();
    const started = await startChange(login, newMobile);
    const challengeId = (started.body as { challengeId: string }).challengeId;
    await server()
      .post('/v1/auth/otp/verify')
      .send({ challengeId, code: sms(app()).lastCodeFor(newMobile), locale: 'or' })
      .expect(400);
    await requestCode(app(), newMobile).expect(200);
  });
});
