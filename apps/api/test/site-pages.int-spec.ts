import { restoreContentPages } from './content-restore.js';
import { adminSignIn, nextTotp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';

describe('Homepage public content (AD-09)', () => {
  const { app, server, db } = useApp();
  restoreContentPages(db, [
    'about',
    'verification',
    'areas',
    'contact',
    'grievance',
    'provider-agreement',
    'patient-rights',
  ]);
  it('AD-09 seven new pages exist in all languages and remain editable with admin authorization', async () => {
    const slugs = [
      'about',
      'verification',
      'areas',
      'contact',
      'grievance',
      'provider-agreement',
      'patient-rights',
    ];
    for (const slug of slugs)
      for (const locale of ['or', 'en', 'hi']) {
        const page = await server().get(`/v1/pages/${slug}?locale=${locale}`).expect(200);
        const content = page.body as { slug: string; locale: string; title: string; body: string };
        expect(content).toMatchObject({ slug, locale });
        expect(content.title).toBeTypeOf('string');
        expect(content.body).toBeTypeOf('string');
      }
    await server()
      .put('/admin/v1/content/pages/about/en')
      .send({ title: 'Synthetic title', body: 'Synthetic body' })
      .expect(401);
    const admin = await adminSignIn(app(), 'super_admin');
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    for (const slug of slugs)
      for (const locale of ['or', 'en', 'hi']) {
        await server()
          .put(`/admin/v1/content/pages/${slug}/${locale}`)
          .set(bearer(admin))
          .send({ title: 'Approved synthetic title', body: 'Approved synthetic body' })
          .expect(204);
        const page = await server().get(`/v1/pages/${slug}?locale=${locale}`).expect(200);
        expect(page.body).toMatchObject({
          title: 'Approved synthetic title',
          body: 'Approved synthetic body',
        });
      }
  });
});
