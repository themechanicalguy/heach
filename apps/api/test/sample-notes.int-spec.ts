import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { bearer, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { captureOutput } from './capture-output.js';
import { connectAs } from './db.js';

const ODIA_NOTE = 'ଆଜି ମୋର ମୁଣ୍ଡ ବିନ୍ଧୁଛି ଓ ଜ୍ୱର ଅଛି। ୧୦୦.୪°F'; // synthetic

describe('Sample patient note (EN-03, EN-13, SE-02, SE-05, SE-09, I18N-04)', () => {
  let app: INestApplication<App>;
  let admin: pg.Client;
  let patientA: Login;
  let patientB: Login;
  // Everything the process writes, to prove the note never reaches the logs (EN-13.1).
  const output = captureOutput();

  beforeAll(async () => {
    app = await bootApp();
    admin = await connectAs('admin');
    [patientA, patientB] = await Promise.all([
      login(app, USERS.patientA),
      login(app, USERS.patientB),
    ]);
  });

  afterAll(async () => {
    output.stop();
    await admin.end();
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function createNote(owner: Login, body = ODIA_NOTE): Promise<string> {
    const response = await server()
      .post('/v1/sample/notes')
      .set(bearer(owner))
      .send({ body })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it('EN-03.1 EN-13.1 stores the body as ciphertext only', async () => {
    const id = await createNote(patientA);
    const { rows } = await admin.query<{ raw: string }>(
      'SELECT body::text AS raw FROM app.patient_note WHERE id = $1',
      [id],
    );
    expect(rows[0]?.raw).toContain('"algorithm": "AES-256-GCM"');
    expect(rows[0]?.raw).not.toContain(ODIA_NOTE);
    expect(rows[0]?.raw).not.toContain('ମୁଣ୍ଡ');
  });

  it('I18N-04.1 an Odia note survives save and read unchanged', async () => {
    const id = await createNote(patientA);
    const response = await server().get(`/v1/sample/notes/${id}`).set(bearer(patientA)).expect(200);
    expect((response.body as { body: string }).body).toBe(ODIA_NOTE);
  });

  it('SE-02.3 EN-13.1 another patient gets 404, no body, and the denial is audited', async () => {
    const id = await createNote(patientA);
    const response = await server().get(`/v1/sample/notes/${id}`).set(bearer(patientB)).expect(404);
    expect(JSON.stringify(response.body)).not.toContain(ODIA_NOTE);
    const { rows } = await admin.query<{ actor_id: string }>(
      "SELECT actor_id FROM audit.entry WHERE action = 'sample_note.read.denied' AND entity_id = $1",
      [id],
    );
    expect(rows.map((r) => r.actor_id)).toEqual([USERS.patientB]);
  });

  it("lists only the caller's own notes", async () => {
    const id = await createNote(patientA);
    const response = await server().get('/v1/sample/notes').set(bearer(patientB)).expect(200);
    expect((response.body as { id: string }[]).map((n) => n.id)).not.toContain(id);
  });

  it('SE-05.2 audit entries hold the correlation ID and no Restricted values', async () => {
    const response = await server()
      .post('/v1/sample/notes')
      .set(bearer(patientA))
      .set('x-correlation-id', 'corr-test-0001')
      .send({ body: ODIA_NOTE })
      .expect(201);
    const { rows } = await admin.query<Record<string, unknown>>(
      'SELECT * FROM audit.entry WHERE entity_id = $1',
      [(response.body as { id: string }).id],
    );
    expect(rows[0]).toMatchObject({
      actor_id: USERS.patientA,
      actor_role: 'patient',
      action: 'sample_note.create',
      correlation_id: 'corr-test-0001',
    });
    expect(JSON.stringify(rows)).not.toContain('ମୁଣ୍ଡ');
  });

  it('SE-09.1 responses with Restricted data are not cached', async () => {
    const id = await createNote(patientA);
    const response = await server().get(`/v1/sample/notes/${id}`).set(bearer(patientA)).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('EN-13.1 the note never appears in log output', () => {
    expect(output.text()).not.toContain(ODIA_NOTE);
    expect(output.text()).not.toContain('ମୁଣ୍ଡ');
  });
});

describe('Sample note input validation (SO-05.2, SO-08.2)', () => {
  let app: INestApplication<App>;
  let session: Login;

  beforeAll(async () => {
    app = await bootApp();
    session = await login(app, USERS.patientA);
  });

  afterAll(async () => {
    await app.close();
  });

  it('SO-05.2 rejects unknown fields and over-long bodies with 400 and no echo', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/sample/notes')
      .set(bearer(session))
      .send({ body: 'x', sneaky: 'echo-me-please' })
      .expect(400);
    expect(JSON.stringify(response.body)).not.toMatch(/sneaky|echo-me-please/);
    await request(app.getHttpServer())
      .post('/v1/sample/notes')
      .set(bearer(session))
      .send({ body: 'x'.repeat(2001) })
      .expect(400);
  });

  it('SO-08.2 rejects a sample SQL injection with 400', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/sample/notes/${encodeURIComponent("' OR 1=1 --")}`)
      .set(bearer(session));
    expect(response.status).toBe(400);
  });
});

describe('Sample note flag (FF-01.1)', () => {
  it('FF-01.1 the routes do not exist when the flag is off', async () => {
    const app = await bootApp('test', { FEATURE_FLAGS: '' });
    const session = await login(app, USERS.patientA);
    const response = await request(app.getHttpServer())
      .get('/v1/sample/notes')
      .set(bearer(session));
    await app.close();
    expect(response.status).toBe(404);
  });
});
