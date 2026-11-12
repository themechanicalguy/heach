import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { adminSignIn, nextTotp, useApp, type AdminLogin } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { connectAs } from './db.js';

interface Entry {
  seq: string;
  id: string;
  at: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  correlationId: string;
}
interface Page {
  entries: Entry[];
  nextBefore: string | null;
}

const byName = (a: string, b: string) => a.localeCompare(b);
const HOUR_MS = 60 * 60 * 1000;

/** Writes a synthetic audit entry as the database superuser, as the API does through audit.append. */
async function append(
  db: pg.Client,
  entry: { actor: string; role?: string; action: string; entity?: string; entityId?: string },
): Promise<void> {
  await db.query('SELECT audit.append($1, $2, $3, $4, $5, $6)', [
    entry.actor,
    entry.role ?? 'verifier',
    entry.action,
    entry.entity ?? 'test_entity',
    entry.entityId ?? randomUUID(),
    randomUUID(),
  ]);
}

/** The calls every block uses, bound to that block's app. */
function auditCalls({ app, db, server }: ReturnType<typeof useApp>) {
  const search = (admin: AdminLogin, query: Record<string, string | number> = {}) =>
    server().get('/admin/v1/audit').set(bearer(admin)).query(query);
  const exportCsv = (admin: AdminLogin, query: Record<string, string> = {}) =>
    server().get('/admin/v1/audit/export').set(bearer(admin)).query(query);

  async function superAdmin(reverified = false): Promise<AdminLogin> {
    const admin = await adminSignIn(app(), 'super_admin');
    if (reverified) {
      await server()
        .post('/admin/v1/auth/reverify')
        .set(bearer(admin))
        .send({ code: nextTotp(admin.secret) })
        .expect(204);
    }
    return admin;
  }

  const entriesOf = async (admin: AdminLogin, query: Record<string, string | number>) =>
    ((await search(admin, query).expect(200)).body as Page).entries;

  /** Three entries by one fresh actor, oldest first, so filters can be told apart. */
  async function seedActor() {
    const actor = `test-actor-${randomUUID()}`;
    const entityId = randomUUID();
    await append(db(), { actor, action: 'audit_test.first', entityId });
    await append(db(), { actor, role: 'finance', action: 'audit_test.second', entity: 'other' });
    await append(db(), { actor, action: 'audit_test.third' });
    return { actor, entityId };
  }
  const auditCount = async (action: string, actorId: string) =>
    (
      await db().query(
        'SELECT 1 FROM audit.entry WHERE action = $1 AND actor_id = $2 AND entity = $3 AND entity_id IS NULL',
        [action, actorId, 'audit'],
      )
    ).rowCount;
  return { search, exportCsv, superAdmin, entriesOf, seedActor, auditCount };
}

describe('Audit log search: who may use it and what it returns (AD-11)', () => {
  const context = useApp();
  const { app, server } = context;
  const { search, superAdmin, entriesOf, seedActor } = auditCalls(context);

  it('AD-11 only a super admin may search; others and anonymous callers are refused', async () => {
    for (const role of ['verifier', 'support', 'finance'] as const) {
      await search(await adminSignIn(app(), role)).expect(403);
    }
    await server().get('/admin/v1/audit').expect(401);
    await search(await superAdmin()).expect(200);
  });

  it('AD-11 returns entries newest first with seq as a string and no hashes', async () => {
    const admin = await superAdmin();
    const { actor } = await seedActor();
    const entries = await entriesOf(admin, { actorId: actor });
    expect(entries.map((e) => e.action)).toEqual([
      'audit_test.third',
      'audit_test.second',
      'audit_test.first',
    ]);
    expect(typeof entries[0]?.seq).toBe('string');
    expect(Object.keys(entries[0] ?? {}).sort(byName)).toEqual(
      [
        'action',
        'actorId',
        'actorRole',
        'at',
        'correlationId',
        'entity',
        'entityId',
        'id',
        'seq',
      ].sort(byName),
    );
  });

  it('AD-11 rejects malformed filters, cursors and limits', async () => {
    const admin = await superAdmin();
    for (const query of [
      { from: 'yesterday' },
      { to: '2026-02-30T00:00:00Z' },
      { before: 'abc' },
      { before: '-5' },
      { limit: 0 },
      { limit: 201 },
      { actorId: 'x'.repeat(101) },
      { unknown: 'x' },
    ]) {
      await search(admin, query).expect(400);
    }
  });
});

describe('Audit log search: filters and paging (AD-11)', () => {
  const context = useApp();
  const { search, superAdmin, entriesOf, seedActor } = auditCalls(context);

  it('AD-11 each filter narrows the result', async () => {
    const admin = await superAdmin();
    const { actor, entityId } = await seedActor();
    const actions = async (query: Record<string, string>) =>
      (await entriesOf(admin, { actorId: actor, ...query })).map((e) => e.action);

    expect(await actions({})).toHaveLength(3);
    expect(await actions({ actorRole: 'finance' })).toEqual(['audit_test.second']);
    expect(await actions({ action: 'audit_test.fi' })).toEqual(['audit_test.first']);
    expect(await actions({ entity: 'other' })).toEqual(['audit_test.second']);
    expect(await actions({ entityId })).toEqual(['audit_test.first']);
    expect(await entriesOf(admin, { actorId: `${actor}-none` })).toEqual([]);
  });

  it('AD-11 the time range filters on the entry time', async () => {
    const admin = await superAdmin();
    const { actor } = await seedActor();
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
    const count = async (range: Record<string, string>) =>
      (await entriesOf(admin, { actorId: actor, ...range })).length;

    expect(await count({ from: iso(-HOUR_MS), to: iso(HOUR_MS) })).toBe(3);
    expect(await count({ from: iso(HOUR_MS) })).toBe(0);
    expect(await count({ to: iso(-HOUR_MS) })).toBe(0);
  });

  it('AD-11 an action prefix is matched literally, not as a pattern', async () => {
    const admin = await superAdmin();
    const actor = `test-actor-${randomUUID()}`;
    for (const action of ['pct_x.one', 'pctAx.one', 'under_x.one', 'underAx.one', 'back\\x.one']) {
      await context
        .db()
        .query('SELECT audit.append($1, $2, $3, $4, $5, $6)', [
          actor,
          'verifier',
          action,
          'test_entity',
          null,
          randomUUID(),
        ]);
    }
    const prefixed = async (action: string) =>
      (await entriesOf(admin, { actorId: actor, action })).map((e) => e.action);

    expect(await prefixed('pct_')).toEqual(['pct_x.one']);
    expect(await prefixed('under_')).toEqual(['under_x.one']);
    expect(await prefixed('back\\')).toEqual(['back\\x.one']);
    expect(await prefixed('%')).toEqual([]);
    expect(await prefixed('_')).toEqual([]);
  });

  it('AD-11 pages with limit, before and nextBefore until nextBefore is null', async () => {
    const admin = await superAdmin();
    const { actor } = await seedActor();
    const first = (await search(admin, { actorId: actor, limit: 2 }).expect(200)).body as Page;
    expect(first.entries.map((e) => e.action)).toEqual(['audit_test.third', 'audit_test.second']);
    expect(first.nextBefore).toBe(first.entries[1]?.seq);

    const second = (
      await search(admin, { actorId: actor, limit: 2, before: first.nextBefore ?? '' }).expect(200)
    ).body as Page;
    expect(second.entries.map((e) => e.action)).toEqual(['audit_test.first']);
    expect(second.nextBefore).toBeNull();
  });

  it('AD-11 defaults to 50 entries and never returns more than the 200 maximum', async () => {
    const admin = await superAdmin();
    const body = (await search(admin).expect(200)).body as Page;
    expect(body.entries.length).toBeLessThanOrEqual(50);
    expect((await entriesOf(admin, { limit: 200 })).length).toBeLessThanOrEqual(200);
  });
});

describe('Audit log export: fresh TOTP, CSV and self-audit (AD-11)', () => {
  const context = useApp();
  const { app, server } = context;
  const { exportCsv, superAdmin, seedActor, auditCount } = auditCalls(context);

  it('AD-11 the export needs super admin and a fresh TOTP', async () => {
    await server().get('/admin/v1/audit/export').expect(401);
    for (const role of ['verifier', 'support', 'finance'] as const) {
      await exportCsv(await adminSignIn(app(), role)).expect(403);
    }
    const stale = await exportCsv(await superAdmin()).expect(403);
    expect(stale.body).toMatchObject({ code: 'reverification_required' });
  });

  it('AD-11 a fresh TOTP returns an attached CSV with a header row, newest first', async () => {
    const admin = await superAdmin(true);
    const { actor } = await seedActor();
    const response = await exportCsv(admin, { actorId: actor }).expect(200);
    expect(response.headers['content-type']).toMatch(/^text\/csv/);
    expect(response.headers['content-disposition']).toBe('attachment; filename="audit-log.csv"');
    const lines = response.text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      '"seq","id","at","actorId","actorRole","action","entity","entityId","correlationId"',
    );
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"audit_test.third"');
    expect(lines[3]).toContain('"audit_test.first"');
  });

  it('AD-11 the export protects a spreadsheet from a formula in an action', async () => {
    const admin = await superAdmin(true);
    const actor = `test-actor-${randomUUID()}`;
    await context
      .db()
      .query("SELECT audit.append($1, 'verifier', '=1+1', 'e', NULL, $2)", [actor, randomUUID()]);
    const response = await exportCsv(admin, { actorId: actor }).expect(200);
    expect(response.text).toContain(`"'=1+1"`);
  });

  it('AD-11 the search and the export are each audited without the filters', async () => {
    const admin = await superAdmin(true);
    const secret = `needle-${randomUUID()}`;
    await server().get('/admin/v1/audit').set(bearer(admin)).query({ actorId: secret }).expect(200);
    expect(await auditCount('audit.search', admin.id)).toBe(1);
    await exportCsv(admin, { actorId: secret }).expect(200);
    expect(await auditCount('audit.export', admin.id)).toBe(1);
    const { rows } = await context
      .db()
      .query('SELECT 1 FROM audit.entry e WHERE row_to_json(e)::text LIKE $1', [`%${secret}%`]);
    expect(rows).toEqual([]);
  });
});

describe('Audit log: the API role can only call audit.search (AD-11, SE-05.4)', () => {
  let app: pg.Client;
  beforeAll(async () => {
    app = await connectAs('app');
  });
  afterAll(async () => {
    await app.end();
  });

  it('AD-11 heach_app cannot select from audit.entry but can call audit.search', async () => {
    await expect(app.query('SELECT * FROM audit.entry')).rejects.toThrow(/permission denied/);
    await expect(app.query('SELECT hash FROM audit.entry')).rejects.toThrow(/permission denied/);
    const { rows } = await app.query<Record<string, unknown>>(
      'SELECT * FROM audit.search(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0)',
    );
    expect(rows.length).toBeLessThanOrEqual(1);
    expect(Object.keys(rows[0] ?? { seq: 1 })).not.toContain('hash');
  });
});
