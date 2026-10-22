import type { FieldEncryptor } from '@heach/crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { type AuditEvent, AuditService } from '../src/audit/audit.service.js';
import { FIELD_ENCRYPTOR } from '../src/crypto/crypto.tokens.js';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { bearer, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { connectAs } from './db.js';

const NOTE = 'ସିନ୍ଥେଟିକ୍ ନୋଟ୍ (synthetic)';
const IV_BYTES = 12; // the GCM tag follows the IV in the stored ciphertext
const POOL_SIZE = 10;

let app: INestApplication<App>;
let admin: pg.Client;
let patient: Login;

beforeAll(async () => {
  app = await bootApp();
  admin = await connectAs('admin');
  patient = await login(app, USERS.patientB);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await admin.end();
  await app.close();
});

const server = () => request(app.getHttpServer());
let sequence = 0;
function correlationId(): string {
  sequence += 1;
  return `audit-tx-${String(Date.now())}-${String(sequence)}`;
}

/** Sends audit.append with a NULL role through the client it was given: a real database error. */
function failAuditFor(matches: (event: AuditEvent) => boolean): void {
  const audit = app.get(AuditService);
  const pool = app.get<pg.Pool>(PG_POOL);
  const original = audit.record.bind(audit);
  vi.spyOn(audit, 'record').mockImplementation(async (event, client = pool) => {
    if (!matches(event)) return original(event, client);
    await client.query('SELECT audit.append($1, $2, $3, $4, $5, $6)', [
      null,
      null,
      event.action,
      event.entity,
      event.entityId,
      'forced-failure',
    ]);
  });
}

const createNote = (id = correlationId()) =>
  server()
    .post('/v1/sample/notes')
    .set(bearer(patient))
    .set('x-correlation-id', id)
    .send({ body: NOTE });

async function noteCount(): Promise<number> {
  const { rows } = await admin.query<{ n: string }>(
    'SELECT count(*) AS n FROM app.patient_note WHERE owner_id = $1',
    [USERS.patientB],
  );
  return Number(rows[0]?.n);
}

async function entries(correlation: string): Promise<string[]> {
  const { rows } = await admin.query<{ action: string }>(
    'SELECT action FROM audit.entry WHERE correlation_id = $1 ORDER BY seq',
    [correlation],
  );
  return rows.map((row) => row.action);
}

/** Creates a note, then flips one byte of its GCM tag so it can no longer be decrypted. */
async function corruptedNote(): Promise<string> {
  const { id } = (await createNote().expect(201)).body as { id: string };
  const { rows } = await admin.query<{ ciphertext: string }>(
    "SELECT body->>'ciphertext' AS ciphertext FROM app.patient_note WHERE id = $1",
    [id],
  );
  const raw = Buffer.from(rows[0]?.ciphertext ?? '', 'base64');
  raw.writeUInt8((raw.readUInt8(IV_BYTES) + 1) % 256, IV_BYTES);
  await admin.query(
    "UPDATE app.patient_note SET body = jsonb_set(body, '{ciphertext}', to_jsonb($2::text)) WHERE id = $1",
    [id, raw.toString('base64')],
  );
  return id;
}

describe('Transactional audit writes: writes (SE-05.5, SE-05.6, SE-05.10)', () => {
  it('SE-05.5 a failed audit entry leaves no note (repeated 50 times, SC-001)', async () => {
    failAuditFor((event) => event.action === 'sample_note.create');
    const before = await noteCount();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await createNote();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(NOTE);
    }
    expect(await noteCount()).toBe(before);
  });

  it('SE-05.6 a failed write leaves no create entry', async () => {
    const encryptor = app.get<FieldEncryptor>(FIELD_ENCRYPTOR);
    vi.spyOn(encryptor, 'encrypt').mockRejectedValueOnce(new Error('kms unavailable'));
    const id = correlationId();
    expect((await createNote(id)).status).toBe(500);
    expect(await entries(id)).not.toContain('sample_note.create');
  });

  it('SE-05.6 every stored note has its create entry (50 saves, SC-002)', async () => {
    const before = await noteCount();
    const ids = Array.from({ length: 50 }, () => correlationId());
    for (const id of ids) await createNote(id).expect(201);
    expect(await noteCount()).toBe(before + 50);
    const created = await Promise.all(ids.map(entries));
    expect(created.flat().filter((action) => action === 'sample_note.create')).toHaveLength(50);
  });

  it('SE-05.10 failed transactions do not exhaust the pool (SC-003)', async () => {
    failAuditFor((event) => event.action === 'sample_note.create');
    for (let attempt = 0; attempt < 3 * POOL_SIZE; attempt += 1) {
      expect((await createNote()).status).toBe(500);
    }
    vi.restoreAllMocks();
    await createNote().expect(201);
  });
});

describe('Transactional audit writes: reads (SE-05.7, SE-05.8)', () => {
  describe('with a note that cannot be decrypted', () => {
    let corrupted: string;

    beforeEach(async () => {
      corrupted = await corruptedNote();
    });

    afterEach(async () => {
      // Other suites list patient B's notes; never leave an unreadable one behind.
      await admin.query('DELETE FROM app.patient_note WHERE id = $1', [corrupted]);
    });

    it.each([
      ['read', () => `/v1/sample/notes/${corrupted}`],
      ['list', () => '/v1/sample/notes'],
    ])('SE-05.7 a %s that fails after lookup is audited as failed', async (kind, path) => {
      const id = correlationId();
      const response = await server().get(path()).set(bearer(patient)).set('x-correlation-id', id);
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(NOTE);
      expect(await entries(id)).toEqual([`sample_note.${kind}.failed`]);
    });
  });

  it('SE-05.8 a failed read audit returns no data', async () => {
    const { id } = (await createNote().expect(201)).body as { id: string };
    failAuditFor((event) => event.action.endsWith('.read') || event.action.endsWith('.list'));
    for (const path of [`/v1/sample/notes/${id}`, '/v1/sample/notes']) {
      const response = await server().get(path).set(bearer(patient));
      expect(response.status, path).toBe(500);
      expect(JSON.stringify(response.body), path).not.toContain(NOTE);
    }
  });
});
