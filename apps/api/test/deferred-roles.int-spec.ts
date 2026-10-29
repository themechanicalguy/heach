import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  adminSignIn,
  CURRENT_CONSENTS,
  otpSignIn,
  PATIENT_SETUP,
  reverify,
  signedUp,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { bearer, fromResponse, type Login } from './auth-helpers.js';
import { bootApp, WITH_DEFERRED_ROLES } from './boot-app.js';

/** Self-registrable roles deferred beyond the MVP (ADR 0015); clinic front desk comes by invitation. */
const DEFERRED = ['doctor', 'dentist', 'dermatologist'] as const;
const MVP_SETUP: Record<string, Record<string, unknown>> = {
  patient: {},
  representative: { role: 'representative' },
  physiotherapist: { role: 'physiotherapist', languages: ['hi'] },
  nurse: { role: 'nurse', languages: ['or'] },
  attendant: { role: 'attendant', languages: ['or'] },
  lab: { role: 'lab', languages: ['or'], organisationName: 'Synthetic Matrix Lab' },
};

const call = (app: INestApplication<App>) => request(app.getHttpServer());
const me = async (app: INestApplication<App>, login: Login) =>
  (await call(app).get('/v1/me').set(bearer(login)).expect(200)).body as Record<string, unknown>;
const switchTo = (app: INestApplication<App>, login: Login, role: string) =>
  call(app).post('/v1/auth/switch-role').set(bearer(login)).send({ role });

/**
 * The MVP configuration (flag `doctor-and-clinic` off) next to an app with the flag on, over the
 * same database and Redis: grants, drafts, invitations and tokens made while the roles were
 * offered meet an API where they are not, as after the flag is switched off.
 */
function useBothApps() {
  const off = useApp();
  let withFlag: INestApplication<App> | undefined;
  beforeAll(async () => {
    withFlag = await bootApp('test', WITH_DEFERRED_ROLES);
  });
  afterAll(async () => {
    await withFlag?.close();
  });
  const on = () => {
    if (!withFlag) throw new Error('App not booted');
    return withFlag;
  };
  return { off, on };
}

describe('Deferred roles: setup and adding a role (ADR 0015)', () => {
  const { off, on } = useBothApps();

  it('AC-04 setup and adding a role refuse doctor, dentist and dermatologist; offered roles still work', async () => {
    const { mobile, login } = await otpSignIn(off.app());
    expect(await me(off.app(), login)).toMatchObject({
      offeredRoles: ['patient', 'representative', 'physiotherapist', 'nurse', 'attendant', 'lab'],
    });
    for (const role of DEFERRED) {
      const refused = await off.server().put('/v1/me/setup').set(bearer(login)).send({ role });
      expect([refused.status, refused.body]).toMatchObject([400, { code: 'role_unavailable' }]);
    }
    await off.server().put('/v1/me/setup').set(bearer(login)).send({ role: 'nurse' }).expect(204);
    // Adding a role is for finished accounts only, even though the route takes `new_account`.
    await reverify(off.app(), mobile, login);
    const early = await off
      .server()
      .post('/v1/me/roles')
      .set(bearer(login))
      .send({ role: 'nurse', languages: ['or'] });
    expect([early.status, early.body]).toMatchObject([409, { code: 'setup_incomplete' }]);

    const patient = await signedUp(off.app());
    await reverify(off.app(), patient.mobile, patient.login);
    for (const role of DEFERRED) {
      const refused = await off
        .server()
        .post('/v1/me/roles')
        .set(bearer(patient.login))
        .send({ role, languages: ['or'] });
      expect([refused.status, refused.body]).toMatchObject([400, { code: 'role_unavailable' }]);
    }
    expect(await me(off.app(), patient.login)).toMatchObject({
      roles: [{ role: 'patient', available: true }],
    });
  });

  it('AC-04 with the flag on (local, test and dev only) the same roles are offered', async () => {
    const { login } = await otpSignIn(on());
    const body = await me(on(), login);
    expect(body.offeredRoles).toEqual(expect.arrayContaining([...DEFERRED, 'nurse', 'lab']));
    await call(on()).put('/v1/me/setup').set(bearer(login)).send({ role: 'dentist' }).expect(204);
  });

  it.each(Object.keys(MVP_SETUP))(
    'AC-04 %s (MVP role): sign-up, returning sign-in and access are unchanged',
    async (role) => {
      const { mobile } = await signedUp(off.app(), MVP_SETUP[role]);
      const again = await otpSignIn(off.app(), mobile);
      expect(await me(off.app(), again.login)).toMatchObject({
        activeRole: role,
        roles: [{ role, available: true }],
        setup: { complete: true },
      });
      const team = await off.server().get('/v1/organisation').set(bearer(again.login));
      expect(team.status).toBe(role === 'lab' ? 200 : 403);
    },
  );
});

describe('Deferred roles: drafts, grants and sessions made while they were offered (ADR 0015)', () => {
  const { off, on } = useBothApps();

  it('PO-03 a draft saved while the role was offered is kept, resumes at the role step and is not granted', async () => {
    const { login } = await otpSignIn(on());
    await call(on())
      .put('/v1/me/setup')
      .set(bearer(login))
      .send({ ...PATIENT_SETUP, role: 'doctor', languages: ['or'] })
      .expect(204);
    expect(await me(off.app(), login)).toMatchObject({
      setup: {
        complete: false,
        nextStep: 'role',
        draft: { role: 'doctor', fullName: 'Synthetic Person' },
      },
    });
    const complete = () =>
      off
        .server()
        .post('/v1/me/setup/complete')
        .set(bearer(login))
        .send({ consents: CURRENT_CONSENTS });
    const refused = await complete();
    expect([refused.status, refused.body]).toMatchObject([400, { code: 'role_unavailable' }]);
    expect(await me(off.app(), login)).toMatchObject({ roles: [], setup: { complete: false } });
    // Recovery: another role keeps the rest of the draft and completes.
    await off.server().put('/v1/me/setup').set(bearer(login)).send({ role: 'nurse' }).expect(204);
    const done = await complete().expect(200);
    const nurse = { ...login, token: (done.body as { accessToken: string }).accessToken };
    expect(await me(off.app(), nurse)).toMatchObject({
      activeRole: 'nurse',
      roles: [{ role: 'nurse', available: true }],
    });
  });

  it('SE-07 an existing deferred grant: its live token, refresh and switch are refused; the grant and the care role stay', async () => {
    const { mobile, login } = await signedUp(on());
    await reverify(on(), mobile, login);
    await call(on())
      .post('/v1/me/roles')
      .set(bearer(login))
      .send({ role: 'doctor', languages: ['or'] })
      .expect(204);
    const switched = await switchTo(on(), login, 'doctor').expect(200);
    const doctor = { ...login, token: (switched.body as { accessToken: string }).accessToken };

    // The live access token in the doctor role is revoked at first use.
    await off.server().get('/v1/me').set(bearer(doctor)).expect(401);
    await call(on()).get('/v1/me').set(bearer(doctor)).expect(401);
    // The device's session in the doctor role ends at refresh, as for a removed role.
    await off.server().post('/v1/auth/refresh').set('Cookie', login.cookie).expect(401);

    const again = await otpSignIn(off.app(), mobile);
    expect(await me(off.app(), again.login)).toMatchObject({
      activeRole: 'patient',
      roles: expect.arrayContaining([
        expect.objectContaining({ role: 'patient', available: true }),
        expect.objectContaining({ role: 'doctor', available: false, applicationStatus: 'draft' }),
      ]) as unknown,
    });
    const refused = await switchTo(off.app(), again.login, 'doctor');
    expect([refused.status, refused.body]).toMatchObject([403, { code: 'role_unavailable' }]);
    await off.server().get('/v1/me/linked-patients').set(bearer(again.login)).expect(200);
    const rotated = await off.server().post('/v1/auth/refresh').set('Cookie', again.login.cookie);
    expect(rotated.status).toBe(200);
    expect(await me(off.app(), fromResponse(rotated))).toMatchObject({ activeRole: 'patient' });

    // Where the flag is on, the kept grant acts again: the last role used was the doctor.
    const withRole = await otpSignIn(on(), mobile);
    expect(await me(on(), withRole.login)).toMatchObject({ activeRole: 'doctor' });
  });

  it('AC-04 an account whose only role is deferred signs in with no role, keeps it, and may add a care role', async () => {
    const { mobile } = await signedUp(on(), { role: 'dentist', languages: ['or'] });
    const { login } = await otpSignIn(off.app(), mobile);
    expect(await me(off.app(), login)).toMatchObject({
      activeRole: 'new_account',
      roles: [{ role: 'dentist', available: false }],
      setup: { complete: true, nextStep: null },
    });
    await off.server().get('/v1/organisation').set(bearer(login)).expect(403);
    await off.server().get('/v1/me/linked-patients').set(bearer(login)).expect(403);
    await off.server().put('/v1/me/setup').set(bearer(login)).send({ role: 'nurse' }).expect(409);

    await reverify(off.app(), mobile, login);
    await off
      .server()
      .post('/v1/me/roles')
      .set(bearer(login))
      .send({ role: 'patient' })
      .expect(204);
    const switched = await switchTo(off.app(), login, 'patient').expect(200);
    const patient = { ...login, token: (switched.body as { accessToken: string }).accessToken };
    expect(await me(off.app(), patient)).toMatchObject({
      activeRole: 'patient',
      roles: expect.arrayContaining([
        expect.objectContaining({ role: 'dentist', available: false }),
        expect.objectContaining({ role: 'patient', available: true }),
      ]) as unknown,
    });
  });
});

describe('Deferred roles: clinic staff and the admin view (ADR 0015)', () => {
  const { off, on } = useBothApps();

  it("O-1 a clinic's front desk invitation is neither listed nor accepted; an existing front desk member has no role", async () => {
    const owner = await signedUp(on(), { role: 'dentist', languages: ['or'] });
    await reverify(on(), owner.mobile, owner.login);
    await call(on())
      .put('/v1/organisation/name')
      .set(bearer(owner.login))
      .send({ name: 'Synthetic Dental Care' })
      .expect(204);
    const [member, invitee] = [syntheticMobile(), syntheticMobile()];
    for (const mobile of [member, invitee]) {
      await call(on())
        .post('/v1/organisation/invitations')
        .set(bearer(owner.login))
        .send({ mobile })
        .expect(204);
    }
    const staff = await otpSignIn(on(), member);
    const [invitation] = (await call(on()).get('/v1/me/invitations').set(bearer(staff.login)))
      .body as { id: string }[];
    const staffSetup = {
      invitationId: invitation?.id,
      fullName: 'Synthetic Staff',
      gender: 'female',
      adultDeclared: true,
    };
    await call(on()).put('/v1/me/setup').set(bearer(staff.login)).send(staffSetup).expect(204);
    await call(on())
      .post('/v1/me/setup/complete')
      .set(bearer(staff.login))
      .send({ consents: CURRENT_CONSENTS })
      .expect(200);

    const pending = await otpSignIn(off.app(), invitee);
    expect(await me(off.app(), pending.login)).toMatchObject({ invitations: 0 });
    const listed = await off.server().get('/v1/me/invitations').set(bearer(pending.login));
    expect(listed.body).toEqual([]);
    const [open] = (await call(on()).get('/v1/me/invitations').set(bearer(pending.login))).body as {
      id: string;
    }[];
    const refused = await off
      .server()
      .put('/v1/me/setup')
      .set(bearer(pending.login))
      .send({ invitationId: open?.id });
    expect([refused.status, refused.body]).toMatchObject([400, { code: 'role_unavailable' }]);

    const again = await otpSignIn(off.app(), member);
    expect(await me(off.app(), again.login)).toMatchObject({
      activeRole: 'new_account',
      roles: [{ role: 'clinic_front_desk', available: false }],
    });
  });

  it('AD-03 admins see a deferred grant kept and marked unavailable', async () => {
    const { mobile } = await signedUp(on(), { role: 'dermatologist', languages: ['en'] });
    const admin = await adminSignIn(off.app(), 'support');
    const page = await off
      .server()
      .get('/admin/v1/users')
      .query({ q: mobile })
      .set(bearer(admin))
      .expect(200);
    expect(page.body).toMatchObject({
      items: [{ roles: [{ role: 'dermatologist', available: false }] }],
    });
  });
});
