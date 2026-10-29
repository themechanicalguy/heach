import { signedUp, statusesOf, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { captureOutput } from './capture-output.js';

const CHILD = { fullName: 'ସମୀର ସାହୁ', birthYear: 2016, gender: 'male', relationship: 'child' };

describe('Linked patients: add, edit, remove, ownership (AC-03, default D-1)', () => {
  const { app, db, server } = useApp();
  const list = async (login: Login) =>
    (await server().get('/v1/me/linked-patients').set(bearer(login)).expect(200)).body as {
      id: string;
    }[];
  const add = (login: Login, body: object = CHILD) =>
    server().post('/v1/me/linked-patients').set(bearer(login)).send(body);

  it('AC-03 a representative adds, edits and removes a linked patient', async () => {
    const { login } = await signedUp(app(), { role: 'representative' });
    const created = await add(login).expect(201);
    const id = (created.body as { id: string }).id;
    expect(created.body).toEqual({ id, ...CHILD });
    await server()
      .put(`/v1/me/linked-patients/${id}`)
      .set(bearer(login))
      .send({ ...CHILD, fullName: 'Samir Sahu' })
      .expect(204);
    expect(await list(login)).toEqual([{ id, ...CHILD, fullName: 'Samir Sahu' }]);
    await server().delete(`/v1/me/linked-patients/${id}`).set(bearer(login)).expect(204);
    expect(await list(login)).toEqual([]);
  });

  it('AC-03 a patient may also link people; a provider role may not', async () => {
    const patient = await signedUp(app());
    await add(patient.login).expect(201);
    const nurse = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await add(nurse.login).expect(403);
    await server().get('/v1/me/linked-patients').set(bearer(nurse.login)).expect(403);
  });

  it('SE-02 another account’s linked patient is never read, changed or removed', async () => {
    const owner = await signedUp(app(), { role: 'representative' });
    const id = ((await add(owner.login).expect(201)).body as { id: string }).id;
    const other = await signedUp(app(), { role: 'representative' });
    expect(await list(other.login)).toEqual([]);
    await server()
      .put(`/v1/me/linked-patients/${id}`)
      .set(bearer(other.login))
      .send(CHILD)
      .expect(404);
    await server().delete(`/v1/me/linked-patients/${id}`).set(bearer(other.login)).expect(404);
    expect(await list(owner.login)).toHaveLength(1);
  });

  it('AC-03 input is validated: relationship from the list, no future year, no extra fields', async () => {
    const { login } = await signedUp(app());
    await add(login, { ...CHILD, relationship: 'friend' }).expect(400);
    await add(login, { ...CHILD, birthYear: new Date().getFullYear() + 1 }).expect(400);
    await add(login, { ...CHILD, ownerAccountId: '00000000-0000-4000-8000-000000000001' }).expect(
      400,
    );
    await add(login, { ...CHILD, fullName: '<script>' }).expect(400);
  });

  it('D-2 at most 10 per account, even when adds race', async () => {
    const { login } = await signedUp(app());
    for (let i = 0; i < 8; i += 1) await add(login).expect(201);
    const racing = await Promise.all([add(login), add(login), add(login)]);
    expect(statusesOf(racing)).toEqual([201, 201, 409]);
    expect(await list(login)).toHaveLength(10);
  });

  it('SE-05 every change is audited by profile ID only; names are never logged', async () => {
    const { login } = await signedUp(app());
    const output = captureOutput();
    try {
      const id = ((await add(login).expect(201)).body as { id: string }).id;
      await server().delete(`/v1/me/linked-patients/${id}`).set(bearer(login)).expect(204);
    } finally {
      output.stop();
    }
    expect(output.text()).not.toContain(CHILD.fullName);
    const { rows } = await db().query<{ action: string; detail: string }>(
      `SELECT action, row_to_json(e)::text AS detail FROM audit.entry e
        WHERE entity = 'linked_patient' ORDER BY seq DESC LIMIT 2`,
    );
    expect(rows.map((row) => row.action)).toEqual([
      'linked_patient.removed',
      'linked_patient.added',
    ]);
    for (const row of rows) expect(row.detail).not.toContain(CHILD.fullName);
  });
});
