import type { EncryptedField, EnvelopeEncryptor } from '@heach/crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuditService } from '../src/audit/audit.service.js';
import { runWithContext } from '../src/common/request-context.js';
import { FIELD_ENCRYPTOR } from '../src/crypto/crypto.tokens.js';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { reencryptHealth } from '../src/jobs/reencrypt.js';
import { bearer, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { connectAs } from './db.js';

const IV_BYTES = 12;
// Creates 120 notes and re-encrypts the whole shared table; slower than the 5 s default in CI.
const SLOW_TEST_TIMEOUT_MS = 30_000;
const byText = (a: string, b: string) => a.localeCompare(b);

let app: INestApplication<App>;
let admin: pg.Client;
let patient: Login;
let encryptor: EnvelopeEncryptor;
const cleanup: string[] = [];

beforeAll(async () => {
  app = await bootApp();
  admin = await connectAs('admin');
  patient = await login(app, USERS.patientA);
  encryptor = app.get<EnvelopeEncryptor>(FIELD_ENCRYPTOR);
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Other suites read patient A's notes; never leave an unreadable one behind.
  await admin.query('DELETE FROM app.patient_note WHERE id = ANY($1::uuid[])', [cleanup.splice(0)]);
});

afterAll(async () => {
  await admin.end();
  await app.close();
});

let runs = 0;
/** Runs the job as the job's entry point does: system actor, one correlation ID per run. */
async function runJob(): Promise<{
  runId: string;
  counts: Awaited<ReturnType<typeof reencryptHealth>>;
}> {
  runs += 1;
  const runId = `reencrypt-test-${String(Date.now())}-${String(runs)}`;
  const counts = await runWithContext({ correlationId: runId, system: 'job:reencrypt' }, () =>
    reencryptHealth(app.get(PG_POOL), encryptor, app.get(AuditService)),
  );
  return { runId, counts };
}

async function createNotes(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const response = await request(app.getHttpServer())
      .post('/v1/sample/notes')
      .set(bearer(patient))
      .send({ body: `synthetic re-encryption note ${String(i)}` })
      .expect(201);
    ids.push((response.body as { id: string }).id);
  }
  return ids;
}

async function createNote(): Promise<string> {
  const [id] = await createNotes(1);
  if (!id) throw new Error('note not created');
  return id;
}

async function bodyOf(id: string): Promise<EncryptedField> {
  const { rows } = await admin.query<{ body: EncryptedField }>(
    'SELECT body FROM app.patient_note WHERE id = $1',
    [id],
  );
  const body = rows[0]?.body;
  if (!body) throw new Error('note not found');
  return body;
}

async function staleCount(target: number): Promise<number> {
  const { rows } = await admin.query<{ n: string }>(
    "SELECT count(*) AS n FROM app.patient_note WHERE (body ->> 'keyVersion')::int < $1",
    [target],
  );
  return Number(rows[0]?.n);
}

async function entries(
  runId: string,
): Promise<{ action: string; actor_role: string; actor_id: string; entity_id: string }[]> {
  const { rows } = await admin.query<{
    action: string;
    actor_role: string;
    actor_id: string;
    entity_id: string;
  }>('SELECT action, actor_role, actor_id, entity_id FROM audit.entry WHERE correlation_id = $1', [
    runId,
  ]);
  return rows;
}

async function corrupt(id: string): Promise<void> {
  const raw = Buffer.from((await bodyOf(id)).ciphertext, 'base64');
  raw.writeUInt8((raw.readUInt8(IV_BYTES) + 1) % 256, IV_BYTES);
  await admin.query(
    "UPDATE app.patient_note SET body = jsonb_set(body, '{ciphertext}', to_jsonb($2::text)) WHERE id = $1",
    [id, raw.toString('base64')],
  );
}

/** Changes these rows while the job runs, right after it decrypts them: its update then misses. */
function changeDuringRun(ids: string[]): void {
  const pending = new Set(ids);
  const decrypt = encryptor.decrypt.bind(encryptor);
  vi.spyOn(encryptor, 'decrypt').mockImplementation(async (value) => {
    const plaintext = await decrypt(value);
    const { rows } = await admin.query<{ id: string }>(
      'SELECT id FROM app.patient_note WHERE body = $1::jsonb',
      [JSON.stringify(value)],
    );
    const id = rows[0]?.id;
    if (id && pending.delete(id)) {
      await admin.query(
        `UPDATE app.patient_note SET body = jsonb_set(body, '{touched}', '"yes"') WHERE id = $1`,
        [id],
      );
    }
    return plaintext;
  });
}

describe('Bounded, audited re-encryption (EN-05.4 to EN-05.9)', () => {
  it(
    'EN-05.4 EN-05.6 EN-05.7 EN-05.8 one pass with true counts and an entry per change (SC-001, SC-002)',
    async () => {
      const ids = await createNotes(120);
      const [changed, broken] = [ids.slice(0, 5), ids.slice(5, 8)];
      for (const id of broken) await corrupt(id);
      cleanup.push(...broken);
      const target = await encryptor.rotate('health');
      const stale = await staleCount(target);
      changeDuringRun(changed);

      const { runId, counts } = await runJob();

      expect(counts).toEqual({ reencrypted: stale - 8, skipped: 5, failed: 3 });
      const recorded = await entries(runId);
      const done = recorded.filter((e) => e.action === 'sample_note.reencrypt');
      expect(done).toHaveLength(counts.reencrypted);
      expect(done.every((e) => e.actor_role === 'system' && e.actor_id === 'job:reencrypt')).toBe(
        true,
      );
      const failed = recorded.filter((e) => e.action === 'sample_note.reencrypt.failed');
      expect(failed.map((e) => e.entity_id).toSorted(byText)).toEqual(broken.toSorted(byText));
      for (const id of broken) expect((await bodyOf(id)).keyVersion).not.toBe(String(target));
      expect(await staleCount(target)).toBe(8);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('EN-05.5 only rows below the target version are re-encrypted', async () => {
    const old = await createNote();
    const target = await encryptor.rotate('health');
    const current = await createNote();
    const before = await bodyOf(current);
    let newer: string | undefined;
    const decrypt = encryptor.decrypt.bind(encryptor);
    vi.spyOn(encryptor, 'decrypt').mockImplementation(async (value) => {
      if (!newer) {
        await encryptor.rotate('health'); // a second rotation during the run
        newer = await createNote();
      }
      return decrypt(value);
    });
    const { runId } = await runJob();
    const touched = (await entries(runId)).map((e) => e.entity_id);
    expect(touched).toContain(old);
    expect(touched).not.toContain(current);
    expect(touched).not.toContain(newer);
    expect(await bodyOf(current)).toEqual(before);
    expect(Number((await bodyOf(newer ?? '')).keyVersion)).toBeGreaterThan(target);
  });

  it('EN-05.7 a row whose entry cannot be written keeps its old value and is counted failed', async () => {
    const id = await createNote();
    await encryptor.rotate('health');
    const before = await bodyOf(id);
    const audit = app.get(AuditService);
    const record = audit.record.bind(audit);
    vi.spyOn(audit, 'record').mockImplementation(async (event, client) => {
      if (event.entityId === id && event.action === 'sample_note.reencrypt') {
        throw new Error('audit unavailable');
      }
      return record(event, client);
    });
    const { counts } = await runJob();
    expect(counts.failed).toBe(1);
    expect(await bodyOf(id)).toEqual(before);
    vi.restoreAllMocks();
    await runJob(); // leave the table clean for the next test
  });

  it('EN-05.9 a clean re-run reports 0 and audits nothing (SC-003)', async () => {
    await createNotes(3);
    await encryptor.rotate('health');
    const first = await runJob();
    expect(first.counts.skipped + first.counts.failed).toBe(0);
    const second = await runJob();
    expect(second.counts).toEqual({ reencrypted: 0, skipped: 0, failed: 0 });
    expect(await entries(second.runId)).toEqual([]);
  });
});
