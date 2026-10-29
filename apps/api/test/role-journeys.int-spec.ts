import type { Login } from './auth-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  adminSignIn,
  CURRENT_CONSENTS,
  otpSignIn,
  reverify,
  signedUp,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { WITH_DEFERRED_ROLES } from './boot-app.js';

/** Setup answers for each self-registrable role (decision L-5). */
const SELF_REGISTERED: Record<string, Record<string, unknown>> = {
  patient: {},
  representative: { role: 'representative' },
  doctor: { role: 'doctor', languages: ['or'] },
  dentist: { role: 'dentist', languages: ['or'] },
  dermatologist: { role: 'dermatologist', languages: ['en'] },
  physiotherapist: { role: 'physiotherapist', languages: ['hi'] },
  nurse: { role: 'nurse', languages: ['or'] },
  attendant: { role: 'attendant', languages: ['or'] },
  lab: { role: 'lab', languages: ['or'], organisationName: 'Synthetic Matrix Lab' },
};

const CARE = new Set(['patient', 'representative']);
const OWNERS = new Set(['lab', 'dentist', 'dermatologist']);

/** The routes each user role may or may not call (AC-04, SE-02); 200 or 403. */
function expectedFor(role: string): Record<string, number> {
  return {
    'GET /v1/me': 200,
    'GET /v1/me/linked-patients': CARE.has(role) ? 200 : 403,
    'GET /v1/organisation': OWNERS.has(role) ? 200 : 403,
    'GET /admin/v1/users': 403,
  };
}

describe('Every role signs up or is provisioned, signs in again and gets only its access (AC-04)', () => {
  // Every role, including those deferred beyond the MVP (ADR 0015), whose code is kept behind the
  // doctor-and-clinic flag; deferred-roles.int-spec.ts covers the MVP set with the flag off.
  const { app, server } = useApp(WITH_DEFERRED_ROLES);

  async function statuses(login: Login): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const route of Object.keys(expectedFor('patient'))) {
      const path = route.replace('GET ', '');
      out[route] = (await server().get(path).set(bearer(login))).status;
    }
    return out;
  }

  /** A returning sign-in by OTP lands in the role the account holds (no setup again). */
  async function returning(mobile: string, role: string) {
    const again = await otpSignIn(app(), mobile);
    const me = await server().get('/v1/me').set(bearer(again.login)).expect(200);
    expect(me.body).toMatchObject({ activeRole: role, setup: { complete: true } });
    return again.login;
  }

  it.each(Object.keys(SELF_REGISTERED))(
    'AC-04 %s: sign-up, returning sign-in, access',
    async (role) => {
      const { mobile } = await signedUp(app(), SELF_REGISTERED[role]);
      const login = await returning(mobile, role);
      expect(await statuses(login)).toEqual(expectedFor(role));
    },
  );

  it.each([
    ['sample_collector', 'lab', SELF_REGISTERED.lab],
    ['clinic_front_desk', 'dentist', SELF_REGISTERED.dentist],
  ] as const)(
    'O-1 %s: provisioned by a %s, then returning sign-in and access',
    async (role, _owner, setup) => {
      const owner = await signedUp(app(), setup);
      await reverify(app(), owner.mobile, owner.login);
      if (role === 'clinic_front_desk') {
        await server()
          .put('/v1/organisation/name')
          .set(bearer(owner.login))
          .send({ name: 'Synthetic Matrix Clinic' })
          .expect(204);
      }
      const mobile = syntheticMobile();
      await server()
        .post('/v1/organisation/invitations')
        .set(bearer(owner.login))
        .send({ mobile })
        .expect(204);
      const invitee = await otpSignIn(app(), mobile);
      const [invitation] = (await server().get('/v1/me/invitations').set(bearer(invitee.login)))
        .body as { id: string }[];
      await server()
        .put('/v1/me/setup')
        .set(bearer(invitee.login))
        .send({
          invitationId: invitation?.id,
          fullName: 'Synthetic Staff',
          gender: 'female',
          adultDeclared: true,
        })
        .expect(204);
      await server()
        .post('/v1/me/setup/complete')
        .set(bearer(invitee.login))
        .send({ consents: CURRENT_CONSENTS })
        .expect(200);
      const login = await returning(mobile, role);
      expect(await statuses(login)).toEqual(expectedFor(role));
    },
  );

  it.each(['super_admin', 'verifier', 'support', 'finance'] as const)(
    'AD-01 %s: admin realm only; patient routes refuse admin tokens',
    async (role) => {
      const admin = await adminSignIn(app(), role);
      await server().get('/admin/v1/me').set(bearer(admin)).expect(200);
      await server().get('/v1/me').set(bearer(admin)).expect(403);
      await server().get('/v1/me/linked-patients').set(bearer(admin)).expect(403);
      const users = await server().get('/admin/v1/users').set(bearer(admin));
      expect(users.status).toBe(role === 'finance' ? 403 : 200);
      const admins = await server().get('/admin/v1/admins').set(bearer(admin));
      expect(admins.status).toBe(role === 'super_admin' ? 200 : 403);
    },
  );
});
