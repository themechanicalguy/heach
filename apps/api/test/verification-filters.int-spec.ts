import { adminSignIn, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { submittedProvider } from './provider-helpers.js';

const APPLICATIONS = '/admin/v1/applications';

interface Row {
  accountId: string;
  role: string;
  submittedAt: string | null;
  ageDays: number | null;
}

/** Two applications of different types and ages, plus a verifier to read the queue. */
function queueCalls(context: ReturnType<typeof useApp>) {
  const { app, db, server } = context;
  const backdate = (accountId: string, days: number) =>
    db().query(
      `UPDATE app.application_event SET created_at = now() - make_interval(days => $2::int)
        WHERE account_id = $1 AND to_status = 'submitted'`,
      [accountId, days],
    );
  const queue = async (admin: Parameters<typeof bearer>[0], query = '') =>
    (await server().get(`${APPLICATIONS}${query}`).set(bearer(admin)).expect(200)).body as Row[];
  const ids = (rows: Row[]) => rows.map((row) => row.accountId);
  return { app, server, backdate, queue, ids };
}

describe('AD-02 verification queue filters', () => {
  const context = useApp();
  const { app, server, backdate, queue, ids } = queueCalls(context);
  let nurse = '';
  let lab = '';
  let fresh = '';

  beforeAll(async () => {
    nurse = (await submittedProvider(app(), 'nurse')).accountId;
    lab = (await submittedProvider(app(), 'lab')).accountId;
    fresh = (await submittedProvider(app(), 'nurse')).accountId;
    await backdate(nurse, 2);
    await backdate(lab, 5);
  });

  it('AD-02 each row carries its submitted time and age in whole days', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    const rows = await queue(verifier);
    expect(rows.find((row) => row.accountId === nurse)).toMatchObject({ ageDays: 2 });
    expect(rows.find((row) => row.accountId === lab)).toMatchObject({ ageDays: 5 });
    expect(rows.find((row) => row.accountId === fresh)).toMatchObject({ ageDays: 0 });
    expect(rows.find((row) => row.accountId === lab)?.submittedAt).toBeTruthy();
  });

  it('AD-02 the role filter keeps only that provider type', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    const labs = await queue(verifier, '?role=lab');
    expect(ids(labs)).toContain(lab);
    expect(ids(labs)).not.toContain(nurse);
    expect(labs.every((row) => row.role === 'lab')).toBe(true);
    const nurses = await queue(verifier, '?role=nurse');
    expect(ids(nurses)).toEqual(expect.arrayContaining([nurse, fresh]));
    expect(ids(nurses)).not.toContain(lab);
  });

  it('AD-02 the age buckets split the queue by days since submission', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    const under1 = ids(await queue(verifier, '?age=lt1'));
    const middle = ids(await queue(verifier, '?age=1to3'));
    const over3 = ids(await queue(verifier, '?age=gt3'));
    expect(under1).toContain(fresh);
    expect([nurse, lab].some((id) => under1.includes(id))).toBe(false);
    expect(middle).toContain(nurse);
    expect([fresh, lab].some((id) => middle.includes(id))).toBe(false);
    expect(over3).toContain(lab);
    expect([fresh, nurse].some((id) => over3.includes(id))).toBe(false);
  });

  it('AD-02 minAgeDays keeps applications at least that old', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    const atLeast2 = ids(await queue(verifier, '?minAgeDays=2'));
    expect(atLeast2).toEqual(expect.arrayContaining([nurse, lab]));
    expect(atLeast2).not.toContain(fresh);
    const atLeast3 = ids(await queue(verifier, '?minAgeDays=3'));
    expect(atLeast3).toContain(lab);
    expect(atLeast3).not.toContain(nurse);
  });

  it('AD-02 filters combine: role with age, and a bucket with a minimum age', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    expect(ids(await queue(verifier, '?role=nurse&age=1to3'))).toContain(nurse);
    expect(ids(await queue(verifier, '?role=lab&age=1to3'))).not.toContain(lab);
    expect(ids(await queue(verifier, '?role=nurse&age=gt3'))).not.toContain(nurse);
    const both = ids(await queue(verifier, '?age=1to3&minAgeDays=3'));
    expect([nurse, lab, fresh].some((id) => both.includes(id))).toBe(false);
    expect(ids(await queue(verifier, '?role=lab&minAgeDays=5&view=open'))).toContain(lab);
  });

  it('AD-02 the decided view is filtered the same way', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    await server().get(`${APPLICATIONS}/${nurse}`).set(bearer(verifier)).expect(200);
    await server()
      .post(`${APPLICATIONS}/${nurse}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'reject', reason: 'other' })
      .expect(204);
    expect(ids(await queue(verifier, '?view=decided&role=nurse&age=1to3'))).toContain(nurse);
    expect(ids(await queue(verifier, '?view=decided&role=lab'))).not.toContain(nurse);
    expect(ids(await queue(verifier, '?role=nurse&age=1to3'))).not.toContain(nurse);
  });
});

describe('AD-02 verification queue filter validation and access', () => {
  const context = useApp();
  const { app, server, queue, ids } = queueCalls(context);
  let lab = '';

  beforeAll(async () => {
    lab = (await submittedProvider(app(), 'lab')).accountId;
  });

  it('AD-02 invalid filter values are 400', async () => {
    const verifier = await adminSignIn(app(), 'verifier');
    const bad = [
      '?role=doctor',
      '?role=nurse&role=lab',
      '?age=yesterday',
      '?minAgeDays=-1',
      '?minAgeDays=366',
      '?minAgeDays=abc',
      '?minAgeDays=',
      '?minAgeDays=1.5',
      '?district=Khordha',
      "?role=nurse'%20OR%201=1",
    ];
    for (const query of bad) {
      await server().get(`${APPLICATIONS}${query}`).set(bearer(verifier)).expect(400);
    }
  });

  it('AD-02 a super admin may filter; other admins and unauthenticated callers are refused', async () => {
    const superAdmin = await adminSignIn(app(), 'super_admin');
    expect(ids(await queue(superAdmin, '?role=lab'))).toContain(lab);
    for (const role of ['support', 'finance'] as const) {
      const admin = await adminSignIn(app(), role);
      await server().get(`${APPLICATIONS}?role=lab`).set(bearer(admin)).expect(403);
    }
    await server().get(`${APPLICATIONS}?role=lab`).expect(401);
  });
});
