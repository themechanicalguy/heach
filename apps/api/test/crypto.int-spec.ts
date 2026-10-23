import type { BlindIndexer, EnvelopeEncryptor } from '@heach/crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuditService } from '../src/audit/audit.service.js';
import { BLIND_INDEXER, FIELD_ENCRYPTOR } from '../src/crypto/crypto.tokens.js';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { reencryptHealth } from '../src/jobs/reencrypt.js';
import { bearer, login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { connectAs } from './db.js';

describe('Key rotation and re-encryption (EN-05.3)', () => {
  let app: INestApplication<App>;
  let admin: pg.Client;

  beforeAll(async () => {
    app = await bootApp();
    admin = await connectAs('admin');
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  it('EN-05.3 re-encrypts every health value to the current key version', async () => {
    const session = await login(app, USERS.patientA);
    const created = await request(app.getHttpServer())
      .post('/v1/sample/notes')
      .set(bearer(session))
      .send({ body: 'before rotation' })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const encryptor = app.get<EnvelopeEncryptor>(FIELD_ENCRYPTOR);
    const version = String(await encryptor.rotate('health'));

    const counts = await reencryptHealth(app.get(PG_POOL), encryptor, app.get(AuditService));
    expect(counts.reencrypted).toBeGreaterThan(0);

    const { rows } = await admin.query<{ stale: string }>(
      "SELECT count(*) AS stale FROM app.patient_note WHERE body ->> 'keyVersion' <> $1",
      [version],
    );
    expect(rows[0]?.stale).toBe('0');
    const read = await request(app.getHttpServer())
      .get(`/v1/sample/notes/${id}`)
      .set(bearer(session))
      .expect(200);
    expect((read.body as { body: string }).body).toBe('before rotation');
  });
});

describe('Blind index lookups (EN-09)', () => {
  let app: INestApplication<App>;
  let admin: pg.Client;

  beforeAll(async () => {
    app = await bootApp();
    admin = await connectAs('admin');
    // Throwaway table standing in for a searchable Restricted field (Step 3 adds the real ones).
    await admin.query(`
      DROP SCHEMA IF EXISTS en09_fixture CASCADE;
      CREATE SCHEMA en09_fixture;
      CREATE TABLE en09_fixture.contact (id serial PRIMARY KEY, mobile app.encrypted_field NOT NULL, mobile_bidx text NOT NULL);
    `);
  });

  afterAll(async () => {
    await admin.query('DROP SCHEMA en09_fixture CASCADE');
    await admin.end();
    await app.close();
  });

  it('EN-09.1 EN-09.2 stores an HMAC lookup column and finds the row by it alone', async () => {
    const encryptor = app.get<EnvelopeEncryptor>(FIELD_ENCRYPTOR);
    const indexer = app.get<BlindIndexer>(BLIND_INDEXER);
    const mobile = '9000000042'; // synthetic
    await admin.query('INSERT INTO en09_fixture.contact (mobile, mobile_bidx) VALUES ($1, $2)', [
      await encryptor.encrypt(mobile, 'identity'),
      indexer.index('identity', mobile),
    ]);

    const lookup = 'SELECT id, mobile FROM en09_fixture.contact WHERE mobile_bidx = $1';
    const params = [indexer.index('identity', mobile)];
    const { rows } = await admin.query<{ mobile: Parameters<EnvelopeEncryptor['decrypt']>[0] }>(
      lookup,
      params,
    );

    expect(JSON.stringify(params)).not.toContain(mobile);
    expect(lookup).not.toMatch(/mobile\s*=/);
    expect(
      await encryptor.decrypt(
        rows[0]?.mobile ?? { ciphertext: '', keyVersion: '0', algorithm: '', domain: 'identity' },
      ),
    ).toBe(mobile);
    const stored = await admin.query<{ raw: string }>(
      'SELECT mobile::text || mobile_bidx AS raw FROM en09_fixture.contact',
    );
    expect(stored.rows[0]?.raw).not.toContain(mobile);
  });
});
