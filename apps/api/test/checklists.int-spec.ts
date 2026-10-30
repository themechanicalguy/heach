import { adminSignIn, nextTotp, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';

describe('Document checklists without a deployment (AD-08, PO-01)', () => {
  const { app, server } = useApp();

  it('AD-08 a super admin makes an item optional after a fresh code; police verification stays required', async () => {
    const admin = await adminSignIn(app(), 'super_admin');
    const put = (item: string, required: boolean) =>
      server().put(`/admin/v1/checklists/nurse/${item}`).set(bearer(admin)).send({ required });
    await put('qualification_certificate', false).expect(403);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    expect((await put('police_verification', false).expect(400)).body).toMatchObject({
      code: 'checklist_item_fixed',
    });
    await put('nowhere', false).expect(404);
    await put('qualification_certificate', false).expect(204);
    try {
      const nurse = await signedUp(app(), { role: 'nurse', languages: ['or'] });
      const application = (
        await server().get('/v1/provider/application').set(bearer(nurse.login)).expect(200)
      ).body as { items: { key: string; required: boolean }[]; missing: string[] };
      expect(
        application.items.find((item) => item.key === 'qualification_certificate'),
      ).toMatchObject({ required: false });
      expect(application.missing).not.toContain('qualification_certificate');
      expect(application.missing).toContain('police_verification');
      const listed = (await server().get('/admin/v1/checklists').set(bearer(admin)).expect(200))
        .body as { role: string; items: { key: string; fixed: boolean }[] }[];
      expect(
        listed
          .find((row) => row.role === 'nurse')
          ?.items.find((item) => item.key === 'police_verification'),
      ).toMatchObject({ fixed: true });
    } finally {
      await put('qualification_certificate', true).expect(204);
    }
  });
});
