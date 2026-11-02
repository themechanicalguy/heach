import { signedUp, useApp, reverify } from './account-helpers.js';
import { bearer } from './auth-helpers.js';

describe('Remembered PIN per care recipient (SD-04, SE-02, PR-04)', () => {
  const { app, server, db } = useApp();
  it('keeps self and linked-person PINs separate, rejects cross-account access, and exports them', async () => {
    const owner = await signedUp(app());
    const other = await signedUp(app());
    const person = await server()
      .post('/v1/me/linked-patients')
      .set(bearer(owner.login))
      .send({
        fullName: 'Synthetic Parent',
        birthYear: 1950,
        gender: 'female',
        relationship: 'parent',
      })
      .expect(201);
    const id = (person.body as { id: string }).id;
    const read = (body: object) =>
      server().post('/v1/me/care-pin/read').set(bearer(owner.login)).send(body).expect(200);
    expect((await read({})).body).toEqual({ pin: null });
    await server()
      .put('/v1/me/care-pin')
      .set(bearer(owner.login))
      .send({ pin: '751001' })
      .expect(204);
    await server()
      .put('/v1/me/care-pin')
      .set(bearer(owner.login))
      .send({ person: id, pin: '753001' })
      .expect(204);
    expect((await read({})).body).toEqual({ pin: '751001' });
    expect((await read({ person: id })).body).toEqual({ pin: '753001' });
    await server()
      .post('/v1/me/care-pin/read')
      .set(bearer(other.login))
      .send({ person: id })
      .expect(404);
    await server()
      .put('/v1/me/care-pin')
      .set(bearer(other.login))
      .send({ person: id, pin: '751001' })
      .expect(404);
    await server()
      .put('/v1/me/care-pin')
      .set(bearer(owner.login))
      .send({ pin: 'invalid' })
      .expect(400);
    await reverify(app(), owner.mobile, owner.login);
    const exported = await server().get('/v1/me/export').set(bearer(owner.login)).expect(200);
    const pins = (exported.body as { carePins: { person: string | null; pin: string }[] }).carePins;
    expect(pins).toContainEqual({ person: null, pin: '751001' });
    expect(pins).toContainEqual({ person: id, pin: '753001' });
    await server().delete(`/v1/me/linked-patients/${id}`).set(bearer(owner.login)).expect(204);
    expect(
      (await db().query('SELECT 1 FROM app.care_pin WHERE linked_patient_id = $1', [id])).rowCount,
    ).toBe(0);
  });
});
