import type request from 'supertest';
import {
  CURRENT_CONSENTS,
  otpSignIn,
  reverify,
  signedUp,
  statusesOf,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';

const LAB = { role: 'lab', languages: ['or'], organisationName: 'Synthetic Path Lab' };
const DENTIST = { role: 'dentist', languages: ['or'] };
const STAFF_DETAILS = { fullName: 'Synthetic Staff', gender: 'male', adultDeclared: true };

const withToken = (login: Login, response: request.Response): Login => ({
  ...login,
  token: (response.body as { accessToken: string }).accessToken,
});

/** The calls every block uses, bound to that block's app. */
function membershipCalls({ app, server }: ReturnType<typeof useApp>) {
  const me = async (login: Login) =>
    (await server().get('/v1/me').set(bearer(login))).body as Record<string, unknown>;
  const organisation = async (login: Login) =>
    (await server().get('/v1/organisation').set(bearer(login))).body as {
      members: { id: string; status: string; mobile: string }[];
      approved: boolean;
      name: string | null;
    };
  const invitationsOf = async (login: Login) =>
    (await server().get('/v1/me/invitations').set(bearer(login))).body as { id: string }[];

  /** A lab owner who has proved a fresh OTP, ready to invite. */
  async function labOwner() {
    const owner = await signedUp(app(), LAB);
    await reverify(app(), owner.mobile, owner.login);
    return owner;
  }

  function invite(owner: { login: Login }, mobile: string) {
    return server().post('/v1/organisation/invitations').set(bearer(owner.login)).send({ mobile });
  }

  /** A new person signs in, picks the invitation in setup and completes it. */
  async function joinAsNew(mobile: string) {
    const { login } = await otpSignIn(app(), mobile);
    const [invitation] = await invitationsOf(login);
    if (!invitation) throw new Error('no invitation');
    await server()
      .put('/v1/me/setup')
      .set(bearer(login))
      .send({ invitationId: invitation.id, ...STAFF_DETAILS })
      .expect(204);
    const done = await server()
      .post('/v1/me/setup/complete')
      .set(bearer(login))
      .send({ consents: CURRENT_CONSENTS })
      .expect(200);
    return { login: withToken(login, done), invitationId: invitation.id };
  }
  return { me, organisation, invitationsOf, labOwner, invite, joinAsNew };
}

describe('Staff memberships: invitations and setup (owner decision O-1)', () => {
  const context = useApp();
  const { app, server } = context;
  const { me, organisation, invitationsOf, labOwner, invite, joinAsNew } = membershipCalls(context);

  it('O-1 sample collector and front desk cannot be chosen at registration', async () => {
    const { login } = await otpSignIn(app());
    for (const role of ['sample_collector', 'clinic_front_desk']) {
      await server().put('/v1/me/setup').set(bearer(login)).send({ role }).expect(400);
    }
    expect(await me(login)).toMatchObject({ setup: { draft: { role: null } } });
  });

  it('O-1 a lab invites a collector, who signs up through the invitation and gets only sign-in', async () => {
    const owner = await labOwner();
    const collectorMobile = syntheticMobile();
    await invite(owner, collectorMobile).expect(204);
    const { login } = await joinAsNew(collectorMobile);
    expect(await me(login)).toMatchObject({
      activeRole: 'sample_collector',
      roles: [{ role: 'sample_collector', side: 'provider', applicationStatus: 'draft' }],
      membership: {
        role: 'sample_collector',
        organisationKind: 'lab',
        organisationName: LAB.organisationName,
        organisationApproved: false,
      },
      invitations: 0,
    });
    const team = await organisation(owner.login);
    expect(team.approved).toBe(false);
    expect(team.members.map((member) => member.status)).toEqual(['active']);
    expect(team.members[0]?.mobile).toMatch(/\d{4}$/);
    expect(team.members[0]?.mobile).not.toContain(collectorMobile.slice(3, 9));
  });

  it('O-1 inviting needs a fresh OTP; only lab, dentist and dermatologist accounts manage staff', async () => {
    const owner = await signedUp(app(), LAB);
    await invite(owner, syntheticMobile()).expect(403);
    const patient = await signedUp(app());
    await server().get('/v1/organisation').set(bearer(patient.login)).expect(403);
    await reverify(app(), patient.mobile, patient.login);
    await invite(patient, syntheticMobile()).expect(403);
    expect((await organisation(owner.login)).members).toEqual([]);
  });

  it('O-1 a clinic must be named before it invites; it invites front desk staff', async () => {
    const dentist = await signedUp(app(), DENTIST);
    await reverify(app(), dentist.mobile, dentist.login);
    const unnamed = await invite(dentist, syntheticMobile()).expect(409);
    expect(unnamed.body).toMatchObject({ code: 'organisation_unnamed' });
    await server()
      .put('/v1/organisation/name')
      .set(bearer(dentist.login))
      .send({ name: 'Synthetic Dental Care' })
      .expect(204);
    const mobile = syntheticMobile();
    await invite(dentist, mobile).expect(204);
    const { login } = await joinAsNew(mobile);
    expect(await me(login)).toMatchObject({
      activeRole: 'clinic_front_desk',
      roles: [{ role: 'clinic_front_desk', applicationStatus: null }],
      membership: { organisationKind: 'clinic', organisationName: 'Synthetic Dental Care' },
    });
  });

  it('O-1 an owner cannot invite their own number, or the same number twice', async () => {
    const owner = await labOwner();
    expect((await invite(owner, owner.mobile).expect(409)).body).toMatchObject({
      code: 'cannot_invite_self',
    });
    const mobile = syntheticMobile();
    await invite(owner, mobile).expect(204);
    expect((await invite(owner, mobile).expect(409)).body).toMatchObject({
      code: 'already_invited',
    });
  });

  it('SE-02 an invitation answers only to the number it was sent to', async () => {
    const owner = await labOwner();
    const mobile = syntheticMobile();
    await invite(owner, mobile).expect(204);
    const invited = await otpSignIn(app(), mobile);
    const [invitation] = await invitationsOf(invited.login);
    const stranger = await otpSignIn(app());
    expect(await invitationsOf(stranger.login)).toEqual([]);
    await server()
      .put('/v1/me/setup')
      .set(bearer(stranger.login))
      .send({ invitationId: invitation?.id })
      .expect(404);
    await server()
      .post(`/v1/me/invitations/${invitation?.id ?? ''}/decline`)
      .set(bearer(stranger.login))
      .expect(404);
  });
});

describe('Staff memberships: removal and revocation (D-7, SE-02)', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { me, organisation, invitationsOf, labOwner, invite } = membershipCalls(context);

  it('O-1 an expired invitation cannot be accepted, and setup cannot complete on it', async () => {
    const owner = await labOwner();
    const mobile = syntheticMobile();
    await invite(owner, mobile).expect(204);
    const { login } = await otpSignIn(app(), mobile);
    const [invitation] = await invitationsOf(login);
    await server()
      .put('/v1/me/setup')
      .set(bearer(login))
      .send({ invitationId: invitation?.id, ...STAFF_DETAILS })
      .expect(204);
    await db().query(
      `UPDATE app.membership SET expires_at = now() - interval '1 minute' WHERE id = $1`,
      [invitation?.id],
    );
    expect(await invitationsOf(login)).toEqual([]);
    const refused = await server()
      .post('/v1/me/setup/complete')
      .set(bearer(login))
      .send({ consents: CURRENT_CONSENTS })
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'invitation_closed' });
    expect(await me(login)).toMatchObject({ roles: [], setup: { complete: false } });
  });

  it('O-1 a declined or revoked invitation is closed for good', async () => {
    const owner = await labOwner();
    const declined = syntheticMobile();
    await invite(owner, declined).expect(204);
    const invitee = await otpSignIn(app(), declined);
    const [first] = await invitationsOf(invitee.login);
    await server()
      .post(`/v1/me/invitations/${first?.id ?? ''}/decline`)
      .set(bearer(invitee.login))
      .expect(204);
    expect(await invitationsOf(invitee.login)).toEqual([]);

    const revoked = syntheticMobile();
    await invite(owner, revoked).expect(204);
    const [pending] = (await organisation(owner.login)).members;
    await server()
      .delete(`/v1/organisation/members/${pending?.id ?? ''}`)
      .set(bearer(owner.login))
      .expect(204);
    const late = await otpSignIn(app(), revoked);
    expect(await invitationsOf(late.login)).toEqual([]);
  });

  it('D-7 removing a member signs out at once every device in the staff role, and only those', async () => {
    const owner = await labOwner();
    const member = await signedUp(app());
    await invite(owner, member.mobile).expect(204);
    const [invitation] = await invitationsOf(member.login);
    await server()
      .post(`/v1/me/invitations/${invitation?.id ?? ''}/accept`)
      .set(bearer(member.login))
      .expect(403);
    await reverify(app(), member.mobile, member.login);
    await server()
      .post(`/v1/me/invitations/${invitation?.id ?? ''}/accept`)
      .set(bearer(member.login))
      .expect(204);
    const patientDevice = await otpSignIn(app(), member.mobile);
    const switched = await server()
      .post('/v1/auth/switch-role')
      .set(bearer(member.login))
      .send({ role: 'sample_collector' })
      .expect(200);
    const staffDevice = withToken(member.login, switched);
    await server().get('/v1/me').set(bearer(staffDevice)).expect(200);

    const [active] = (await organisation(owner.login)).members;
    await server()
      .delete(`/v1/organisation/members/${active?.id ?? ''}`)
      .set(bearer(owner.login))
      .expect(204);
    await server().get('/v1/me').set(bearer(staffDevice)).expect(401);
    await server().post('/v1/auth/refresh').set('Cookie', staffDevice.cookie).expect(401);
    expect(await me(patientDevice.login)).toMatchObject({
      activeRole: 'patient',
      roles: [{ role: 'patient' }],
      membership: null,
    });
  });
});

describe('Staff memberships: acceptance rules (owner decision O-1)', () => {
  const context = useApp();
  const { app, db, server } = context;
  const { me, organisation, invitationsOf, labOwner, invite, joinAsNew } = membershipCalls(context);

  it('SE-02 an owner cannot remove another organisation’s member', async () => {
    const owner = await labOwner();
    const other = await labOwner();
    await invite(owner, syntheticMobile()).expect(204);
    const [pending] = (await organisation(owner.login)).members;
    await server()
      .delete(`/v1/organisation/members/${pending?.id ?? ''}`)
      .set(bearer(other.login))
      .expect(404);
    expect((await organisation(owner.login)).members).toHaveLength(1);
  });

  it('O-1 two accepts of one invitation grant the role once', async () => {
    const owner = await labOwner();
    const member = await signedUp(app());
    await invite(owner, member.mobile).expect(204);
    const [invitation] = await invitationsOf(member.login);
    await reverify(app(), member.mobile, member.login);
    const accept = () =>
      server()
        .post(`/v1/me/invitations/${invitation?.id ?? ''}/accept`)
        .set(bearer(member.login));
    expect(statusesOf(await Promise.all([accept(), accept()]))).toEqual([204, 409]);
    const { rows } = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.role_assignment r
         JOIN app.membership m ON m.account_id = r.account_id
        WHERE m.id = $1 AND r.side = 'provider'`,
      [invitation?.id],
    );
    expect(rows[0]?.n).toBe(1);
  });

  it('O-1 an account that already has a provider role cannot accept a staff invitation', async () => {
    const owner = await labOwner();
    const nurse = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await invite(owner, nurse.mobile).expect(204);
    const [invitation] = await invitationsOf(nurse.login);
    await reverify(app(), nurse.mobile, nurse.login);
    const refused = await server()
      .post(`/v1/me/invitations/${invitation?.id ?? ''}/accept`)
      .set(bearer(nurse.login))
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'side_taken' });
  });

  it('O-1 a staff member’s lab is approved only when the lab owner’s application is', async () => {
    const owner = await labOwner();
    const mobile = syntheticMobile();
    await invite(owner, mobile).expect(204);
    const { login, invitationId } = await joinAsNew(mobile);
    await db().query(
      `UPDATE app.role_assignment SET application_status = 'approved'
        WHERE side = 'provider' AND account_id = (
          SELECT o.owner_account_id FROM app.organisation o
            JOIN app.membership m ON m.organisation_id = o.id WHERE m.id = $1)`,
      [invitationId],
    );
    expect(await me(login)).toMatchObject({ membership: { organisationApproved: true } });
  });
});
